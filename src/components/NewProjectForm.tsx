'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, createProject } from '@/app/actions/actions'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Card, Input, Button } from '@/components/ui/components'
import { toast } from 'sonner'

const PROJECT_COLORS = [
  '#0051e6', // Blue
  '#34c759', // Green
  '#ff9500', // Orange
  '#ff3b30', // Red
  '#af52de', // Purple
  '#5856d6', // Indigo
  '#86868b', // Gray
]

export default function NewProjectForm({ members }: { members: Profile[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: PROJECT_COLORS[0],
    memberIds: [] as string[]
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) return toast.error('Project name is required')
    
    setLoading(true)
    try {
      const project = await createProject(form)
      toast.success('Project created successfully!')
      router.push(`/dashboard/projects/${project.id}`)
      router.refresh()
    } catch (error) {
      toast.error('Failed to create project')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const toggleMember = (id: string) => {
    setForm(prev => ({
      ...prev,
      memberIds: prev.memberIds.includes(id) 
        ? prev.memberIds.filter(m => m !== id)
        : [...prev.memberIds, id]
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="p-8 space-y-6 bg-white/80 backdrop-blur-xl border-none shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
        <div className="space-y-2">
          <label className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] ml-1">Project Name</label>
          <Input 
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            placeholder="e.g. Q1 Marketing Campaign"
            className="h-14 text-lg font-bold bg-[#f5f5f7] border-none focus:ring-2 focus:ring-[#0051e6] transition-all"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] ml-1">Description (Optional)</label>
          <textarea 
            value={form.description}
            onChange={e => setForm({...form, description: e.target.value})}
            placeholder="What is this project about?"
            className="w-full min-h-[100px] p-4 rounded-2xl bg-[#f5f5f7] border-none text-sm font-medium focus:ring-2 focus:ring-[#0051e6] transition-all resize-none"
          />
        </div>

        <div className="space-y-4">
          <label className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] ml-1">Project Color</label>
          <div className="flex gap-4 px-2">
            {PROJECT_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setForm({...form, color})}
                className={`w-8 h-8 rounded-full transition-all duration-300 ring-offset-4 ${form.color === color ? 'ring-2 ring-[#0051e6] scale-110' : 'hover:scale-105 opacity-60 hover:opacity-100'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-8 space-y-6 bg-white/80 backdrop-blur-xl border-none shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] ml-1">Assign Team Members</label>
          <span className="text-[10px] font-bold text-[#0051e6] bg-[#0051e6]/10 px-2 py-0.5 rounded-full">
            {form.memberIds.length} Selected
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {members.map(member => (
            <button
              key={member.id}
              type="button"
              onClick={() => toggleMember(member.id)}
              className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${form.memberIds.includes(member.id) 
                ? 'border-[#0051e6] bg-[#0051e6]/5 shadow-sm' 
                : 'border-[#e5e5ea] bg-white hover:border-[#86868b]'}`}
            >
              <UserAvatar
                name={member.name}
                avatarUrl={member.avatar_url}
                className={`w-8 h-8 rounded-full ${form.memberIds.includes(member.id) ? 'bg-[#0051e6]' : 'bg-[#f5f5f7]'}`}
                textClassName={`text-xs font-black ${form.memberIds.includes(member.id) ? 'text-white' : 'text-[#1d1d1f]'}`}
              />
              <div className="text-left">
                <p className={`text-[11px] font-bold truncate ${form.memberIds.includes(member.id) ? 'text-[#1d1d1f]' : 'text-[#86868b]'}`}>{member.name}</p>
                <p className="text-[9px] text-[#86868b] uppercase tracking-tighter">{member.role}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <div className="flex gap-4 pt-4">
        <Button 
          type="button" 
          variant="secondary" 
          className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] border-none bg-white hover:bg-[#e5e5ea] text-[#86868b]"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="flex-[2] h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-[#0051e6] shadow-[0_8px_30px_rgba(0,113,227,0.3)] hover:shadow-[0_12px_40px_rgba(0,113,227,0.4)] transition-all"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </form>
  )
}
