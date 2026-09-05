import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../shared/services/firebaseService';

export const subscribeMyGoals = (uid, callback) => {
  if (!uid) return () => {};
  const goalsRef = collection(db, 'goals', uid, 'items');
  const q = query(goalsRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const goals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(goals);
  });
};

export const addGoal = async (uid, goalData) => {
  if (!uid) throw new Error('User ID is required');
  const goalsRef = collection(db, 'goals', uid, 'items');
  return await addDoc(goalsRef, {
    ...goalData,
    createdAt: serverTimestamp(),
  });
};

export const updateGoalProgress = async (uid, goalId, progress, status) => {
  if (!uid || !goalId) throw new Error('User ID and Goal ID are required');
  const goalRef = doc(db, 'goals', uid, 'items', goalId);
  return await updateDoc(goalRef, {
    progress,
    status
  });
};

export const deleteGoal = async (uid, goalId) => {
  if (!uid || !goalId) throw new Error('User ID and Goal ID are required');
  const goalRef = doc(db, 'goals', uid, 'items', goalId);
  return await deleteDoc(goalRef);
};
