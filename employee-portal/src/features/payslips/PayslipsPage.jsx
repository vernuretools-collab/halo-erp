import { useState, useEffect, useMemo } from 'react';
import { useUserStore } from '../../stores/userStore';
import { subscribeMyPayslips } from './services/payslipsService';
import { collectUserIdentityIds } from '../projects/services/projectService';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/layout/PageHeader';
import { Receipt } from 'lucide-react';

const isRosterPayslip = (p) => p?.totalAmount != null

export const PayslipsPage = () => {
  const { user, userDoc } = useUserStore();
  const identityIds = useMemo(() => collectUserIdentityIds(user, userDoc), [user, userDoc]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!identityIds.length) return;
    const unsubscribe = subscribeMyPayslips(identityIds, (data) => {
      setPayslips(data.filter(isRosterPayslip));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [identityIds]);

  const uniquePayslips = useMemo(() => {
    const byKey = new Map();
    payslips.forEach((p) => {
      const key = `${p.year}-${p.month}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, p);
        return;
      }
      const preferNew = p.id === `${p.year}-${String(p.month).padStart(2, '0')}`;
      if (preferNew) byKey.set(key, p);
    });
    return Array.from(byKey.values());
  }, [payslips]);

  const years = useMemo(() => {
    const y = new Set(uniquePayslips.map(p => p.year));
    y.add(new Date().getFullYear());
    return Array.from(y).sort((a, b) => b - a);
  }, [uniquePayslips]);

  const filteredPayslips = useMemo(() => {
    return uniquePayslips.filter(p => p.year === selectedYear);
  }, [uniquePayslips, selectedYear]);

  const splitColumns = useMemo(() => {
    return filteredPayslips.reduce((count, p) => {
      const splits = Array.isArray(p.splits) ? p.splits.filter((n) => Number(n) > 0) : []
      return Math.max(count, splits.length)
    }, 0)
  }, [filteredPayslips]);

  const splitPaid = (p) =>
    (Array.isArray(p.splits) ? p.splits : []).reduce((sum, n) => sum + (Number(n) || 0), 0)

  const amountPaid = (p) => {
    if (p.amountPaid != null && Number(p.amountPaid) > 0) return Number(p.amountPaid)
    const paid = splitPaid(p)
    if (paid > 0) return paid
    return Number(p.totalAmount ?? p.netSalary) || 0
  }

  const remainingDue = (p) => {
    const due = Number(p.totalAmount) || 0
    const paid = amountPaid(p)
    return Math.round((due - paid) * 100) / 100
  }

  const showRemaining = filteredPayslips.some((p) => remainingDue(p) > 0)

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="space-y-6">
      <PageHeader title="My Payslips" description="View your monthly salary payments." />

      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border">
        {years.map(year => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              selectedYear === year 
                ? 'border-accent text-accent' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            {year}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="overflow-hidden">
          <div className="p-0">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 animate-pulse">
                <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
            ))}
          </div>
        </Card>
      ) : filteredPayslips.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center text-muted">
          <Receipt className="w-12 h-12 mb-4 text-slate-400 dark:text-slate-500" />
          <p className="text-lg font-medium text-fg mb-1">No payslips available for {selectedYear}.</p>
          <p>Contact HR if you believe this is an error.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-chrome/50 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Month</th>
                  {splitColumns > 0 &&
                    Array.from({ length: splitColumns }, (_, i) => (
                      <th key={i} className="px-6 py-4 font-medium">Split {i + 1}</th>
                    ))}
                  <th className="px-6 py-4 font-medium">Total paid</th>
                  {showRemaining && (
                    <th className="px-6 py-4 font-medium">Remaining</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPayslips.map(payslip => (
                  <tr key={payslip.id} className="bg-surface hover:bg-chrome/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-fg whitespace-nowrap">
                      {monthNames[payslip.month - 1]} {payslip.year}
                    </td>
                    {splitColumns > 0 &&
                      Array.from({ length: splitColumns }, (_, i) => (
                        <td key={i} className="px-6 py-4 text-muted">
                          {formatCurrency((payslip.splits || [])[i] || 0)}
                        </td>
                      ))}
                    <td className="px-6 py-4 font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(amountPaid(payslip))}
                    </td>
                    {showRemaining && (
                      <td className="px-6 py-4 text-amber-600 dark:text-amber-400">
                        {formatCurrency(Math.max(0, remainingDue(payslip)))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
