import { collection, onSnapshot, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../../shared/services/firebaseService';
import {
  expandLeaveDateRange,
  formatHoursAsHrsMins,
  getPermissionHours,
  isPermissionLeave,
  leaveStatusKey,
} from '../../team/services/leaveEntitlementUtils';

const mapApprovedLeavesToEvents = (docs) => {
  const events = [];
  docs.forEach((docSnap) => {
    const data = { ...docSnap.data(), leaveId: docSnap.id };
    if (leaveStatusKey(data) !== 'approved') return;

    const startDate = data.startDate || data.endDate;
    if (!startDate) return;

    const employeeName = data.employeeName || 'Employee';
    const leaveType = data.leaveType || data.requestedLeaveType || 'Leave';
    const permission = isPermissionLeave(data);
    const hoursLabel = permission ? formatHoursAsHrsMins(getPermissionHours(data)) : '';
    const timeRange = permission && data.startTime && data.endTime
      ? `${data.startTime}–${data.endTime} (${hoursLabel})`
      : permission
        ? hoursLabel
        : '';

    expandLeaveDateRange(startDate, data.endDate || startDate).forEach((date) => {
      events.push({
        id: `${data.leaveId || docSnap.id}-${date}`,
        date,
        type: 'leave',
        title: `${employeeName} — ${leaveType}`,
        description: timeRange || undefined,
        allDay: !permission,
      });
    });
  });
  return events;
};

/**
 * Subscribe to companyCalendar, companyHolidays, and approved leaveRequests.
 * Merges them into a single events array for the calendar.
 */
export const subscribeCalendarEvents = (callback) => {
  let calendarEvents = [];
  let holidayEvents = [];
  let leaveEvents = [];

  const mergeAndCallback = () => {
    callback([...holidayEvents, ...calendarEvents, ...leaveEvents]);
  };

  // Listen to companyCalendar (general events: meetings, sprints, anniversaries, etc.)
  const calQ = query(collection(db, 'companyCalendar'), orderBy('date', 'asc'));
  const unsubCalendar = onSnapshot(calQ, (snapshot) => {
    calendarEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndCallback();
  }, () => {
    // Collection may not exist yet — silently ignore
    calendarEvents = [];
    mergeAndCallback();
  });

  // Listen to companyHolidays (admin-marked holidays from HolidayManager)
  const holQ = query(collection(db, 'companyHolidays'), orderBy('date', 'asc'));
  const unsubHolidays = onSnapshot(holQ, (snapshot) => {
    holidayEvents = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.name || data.title || 'Holiday',
        date: data.date,
        type: 'holiday',
        description: data.description || `Marked by ${data.createdBy || 'Admin'}`,
        allDay: true,
      };
    });
    mergeAndCallback();
  }, () => {
    // Collection may not exist yet — silently ignore
    holidayEvents = [];
    mergeAndCallback();
  });

  const unsubLeave = onSnapshot(collection(db, 'leaveRequests'), (snapshot) => {
    leaveEvents = mapApprovedLeavesToEvents(snapshot.docs);
    mergeAndCallback();
  }, () => {
    leaveEvents = [];
    mergeAndCallback();
  });

  return () => {
    unsubCalendar();
    unsubHolidays();
    unsubLeave();
  };
};

/**
 * Get upcoming events from both collections for dashboard widgets.
 */
export const getUpcomingEvents = async (count = 5) => {
  const today = new Date().toISOString().split('T')[0];
  const results = [];

  // Fetch from companyCalendar
  try {
    const calQ = query(
      collection(db, 'companyCalendar'),
      where('date', '>=', today),
      orderBy('date', 'asc'),
      limit(count)
    );
    const calSnap = await getDocs(calQ);
    calSnap.docs.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() });
    });
  } catch {
    // Collection may not exist yet
  }

  // Fetch from companyHolidays (admin-marked)
  try {
    const holQ = query(
      collection(db, 'companyHolidays'),
      where('date', '>=', today),
      orderBy('date', 'asc'),
      limit(count)
    );
    const holSnap = await getDocs(holQ);
    holSnap.docs.forEach(doc => {
      const data = doc.data();
      results.push({
        id: doc.id,
        title: data.name || data.title || 'Holiday',
        date: data.date,
        type: 'holiday',
        description: data.description || `Marked by ${data.createdBy || 'Admin'}`,
        allDay: true,
      });
    });
  } catch {
    // Collection may not exist yet
  }

  try {
    const leaveSnap = await getDocs(collection(db, 'leaveRequests'));
    mapApprovedLeavesToEvents(leaveSnap.docs).forEach((event) => {
      if (event.date >= today) results.push(event);
    });
  } catch {
    // Collection may not exist yet
  }

  // Sort merged results by date, return top `count`
  results.sort((a, b) => a.date.localeCompare(b.date));
  return results.slice(0, count);
};
