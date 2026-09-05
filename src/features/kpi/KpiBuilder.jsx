import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { useKPIStore } from './stores/kpiStore'
import { Activity, SlidersHorizontal, Save } from 'lucide-react'

export const KpiBuilder = () => {
  const navigate = useNavigate()
  const { addKpiDefinition } = useKPIStore()

  const [name, setName] = useState('')
  const [module, setModule] = useState('crm')
  const [formula, setFormula] = useState('(Won Deals / Total Closed Deals) * 100')
  const [targetValue, setTargetValue] = useState(80)
  const [unit, setUnit] = useState('%')
  const [weight, setWeight] = useState(0.25)

  const handleSaveKpi = (e) => {
    e.preventDefault()
    if (!name.trim()) return

    addKpiDefinition({
      name,
      module,
      formula,
      targetValue: Number(targetValue),
      targetOperator: 'gte',
      unit,
      healthScoreWeight: Number(weight),
    })

    navigate('/kpi')
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="KPI Rules & Target Builder"
          description="Define custom organization metrics, mathematical aggregation formulas, and health score weightings"
        />

        <div className="flex items-center gap-2 border-b border-border pb-3">
          <NavLink
            to="/kpi"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <Activity className="w-3.5 h-3.5" /> Health Score Dashboard
          </NavLink>
          <NavLink
            to="/kpi/builder"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> KPI Rules Builder
          </NavLink>
        </div>
      </div>

      <Card className="max-w-xl space-y-4 border-border">
        <form onSubmit={handleSaveKpi} className="space-y-4">
          <Input
            label="KPI Name"
            placeholder="e.g. Lead Conversion Velocity"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-slate-300">Target Module</label>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value)}
                className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none"
              >
                <option value="crm">CRM & Pipeline</option>
                <option value="finance">Finance & Revenue</option>
                <option value="projects">Projects & Delivery</option>
                <option value="team">Team & Personnel</option>
              </select>
            </div>

            <Input
              label="Unit Label"
              placeholder="%, USD, count, hours"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>

          <Input
            label="Formula Description"
            placeholder="e.g. (Total Revenue / Total Expenses)"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Target Threshold Value"
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-slate-300">Health Weight (0 - 1.0)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/kpi')} className="w-1/3">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="w-2/3" icon={Save}>
              Save KPI Rule
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
