import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Building, Globe, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Card } from '../../shared/components/ui/Card'
import { useUserStore } from '../../shared/stores/userStore'
import { useOrgStore } from '../../shared/stores/orgStore'

export const OnboardingWizard = () => {
  const navigate = useNavigate()
  const { user } = useUserStore()
  const { setOrg } = useOrgStore()

  const [step, setStep] = useState(1)
  const [orgName, setOrgName] = useState('')
  const [industry, setIndustry] = useState('agency')
  const [teamSize, setTeamSize] = useState('1-10')

  const handleCreateOrganization = (e) => {
    e.preventDefault()

    // Simulated tenant initialization
    const mockOrg = {
      orgId: `org_${Date.now()}`,
      name: orgName || 'My Service Business',
      slug: (orgName || 'my-business').toLowerCase().replace(/[^a-z0-9]/g, '-'),
      industry,
      plan: 'starter',
      ownerId: user?.uid || 'user_demo',
      createdAt: new Date(),
    }

    setOrg(mockOrg)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-canvas text-fg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/15 blur-[120px] rounded-full pointer-events-none" />

      <Card className="w-full max-w-lg p-8 relative z-10 border-border shadow-2xl">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center border border-accent/20">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-fg text-base">Setup Your Organization</h2>
              <p className="text-xs text-slate-400">Step {step} of 2 — Business Profile</p>
            </div>
          </div>
          <div className="flex gap-1">
            <div className={`w-6 h-1.5 rounded-full ${step >= 1 ? 'bg-accent' : 'bg-canvas'}`} />
            <div className={`w-6 h-1.5 rounded-full ${step >= 2 ? 'bg-accent' : 'bg-canvas'}`} />
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <Input
              label="Company or Business Name"
              placeholder="e.g. Apex Global Consulting"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-slate-300">Industry Category</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent"
              >
                <option value="agency">Agency / Creative Services</option>
                <option value="software">Software / IT Consulting</option>
                <option value="legal">Legal & Professional Services</option>
                <option value="construction">Architecture & Construction</option>
                <option value="accounting">Accounting & Financial Advisory</option>
                <option value="other">Other Service Business</option>
              </select>
            </div>

            <Button
              variant="primary"
              className="w-full mt-4"
              onClick={() => setStep(2)}
              disabled={!orgName.trim()}
              icon={ArrowRight}
            >
              Continue
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateOrganization} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-slate-300">Expected Team Seats</label>
              <select
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent"
              >
                <option value="1-10">1 - 10 members</option>
                <option value="11-50">11 - 50 members</option>
                <option value="51-200">51 - 200 members</option>
                <option value="200+">200+ Enterprise seats</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-border/80 text-xs space-y-2">
              <div className="flex items-center gap-2 text-accent font-medium">
                <CheckCircle2 className="w-4 h-4" /> Ready to Provision Tenant Subtree
              </div>
              <p className="text-slate-400">
                Creating <strong className="text-slate-200">{orgName}</strong> will initialize secure Firestore paths, assign Company Owner custom claims, and launch your executive workspace dashboard.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)} className="w-1/3">
                Back
              </Button>
              <Button type="submit" variant="primary" className="w-2/3" icon={Shield}>
                Provision Workspace
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
