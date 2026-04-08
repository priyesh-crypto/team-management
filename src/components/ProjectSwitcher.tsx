'use client'
import { useRouter, useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Project, deleteProject } from '@/app/actions/actions'
import { LayoutGrid, Plus, Folder, Trash2 } from 'lucide-react'
import { ConfirmationModal } from './ui/ConfirmationModal'
import React from 'react'

export function ProjectSwitcher({ projects, userRole }: { projects: Project[], userRole?: 'employee' | 'manager' }) {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.projectId as string

  const [projectToDelete, setProjectToDelete] = React.useState<{ id: string, name: string } | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDeleteClick = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    setProjectToDelete({ id, name })
  }

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return
    setIsDeleting(true)
    try {
      await deleteProject(projectToDelete.id)
      router.refresh()
      if (projectId === projectToDelete.id) {
        router.push('/dashboard')
      }
      setProjectToDelete(null)
    } catch (err) {
      alert("Failed to delete project.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5 mt-6 px-1">
      {/* All projects view */}
      <button
        onClick={() => router.push('/dashboard')}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 w-full text-left group relative outline-none",
          !projectId
            ? "bg-[#0c64ef]/10 text-[#0c64ef]"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        )}
      >
        <LayoutGrid size={16} strokeWidth={2.5} className={cn("transition-colors", !projectId ? "text-[#0c64ef]" : "text-slate-400 group-hover:text-slate-800")} />
        <span>Main Inbox</span>
        {!projectId && (
            <div className="absolute left-0 w-1 h-5 bg-[#0c64ef] rounded-r-full" />
        )}
      </button>

      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-4 py-4 mt-2">
        My Projects
      </div>

      <div className="space-y-1">
        {projects.length > 0 ? projects.map(project => (
          <div
            key={project.id}
            onClick={() => router.push(`/dashboard/projects/${project.id}`)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-xl text-[10px] font-bold transition-all duration-300 w-full text-left group cursor-pointer relative",
              projectId === project.id
                ? "bg-[#0c64ef]/10 text-[#0c64ef]"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            {/* Color dot */}
            <div 
              className="w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-sm"
              style={{ background: project.color || '#0c64ef' }}
            />
            <span className="truncate flex-1 tracking-tight">{project.name}</span>
            
            <div className="flex items-center gap-2 ml-auto">
                {/* Task count badge */}
                <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-lg transition-colors tabular-nums",
                    projectId === project.id 
                        ? "bg-[#0c64ef] text-white" 
                        : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                )}>
                  {project.task_count ?? 0}
                </span>

                {/* Delete button - Manager only */}
                {userRole === 'manager' && (
                    <button
                        onClick={(e) => handleDeleteClick(e, project.id, project.name)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <Trash2 size={12} strokeWidth={2.5} />
                    </button>
                )}
            </div>
            {projectId === project.id && (
                <div className="absolute left-0 w-1 h-5 bg-[#0c64ef] rounded-r-full" />
            )}
          </div>
        )) : (
            <div className="px-4 py-2 text-[10px] text-slate-400 italic font-medium">
                No active projects
            </div>
        )}
      </div>

      {/* Create new project - Only for managers */}
      {userRole === 'manager' && (
        <button
          onClick={() => router.push('/dashboard/projects/new')}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-[9px] font-bold text-slate-400 hover:text-[#0c64ef] transition-all duration-300 mt-4 group uppercase tracking-widest bg-slate-50/50 hover:bg-slate-50"
        >
          <div className="w-5 h-5 rounded-lg bg-white border border-slate-100 flex items-center justify-center group-hover:bg-[#0c64ef] group-hover:text-white transition-all shadow-sm">
              <Plus size={12} strokeWidth={3} />
          </div>
          Create Project
        </button>
      )}

      <ConfirmationModal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        description={
            <div className="text-slate-500 text-xs">
                Permanently delete <span className="text-slate-800 font-bold">"{projectToDelete?.name}"</span>? 
                <br />
                <span className="block mt-2 opacity-80">Tasks will be archived to Main Project.</span>
            </div>
        }
        confirmText="Confirm Delete"
        isLoading={isDeleting}
      />
    </div>
  )
}
