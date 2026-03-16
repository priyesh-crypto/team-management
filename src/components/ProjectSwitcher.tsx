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
    <div className="flex flex-col gap-1 px-3 mt-4">
      {/* All projects view */}
      <button
        onClick={() => router.push('/dashboard')}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 w-full text-left group",
          !projectId
            ? "bg-[#0071e3] text-white shadow-[0_4px_20px_rgba(0,113,227,0.3)]"
            : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
        )}
      >
        <LayoutGrid size={16} className={cn("transition-colors", !projectId ? "text-white" : "text-[#86868b] group-hover:text-[#1d1d1f]")} />
        Main Project
      </button>

      <div className="text-[9px] font-black text-[#86868b] uppercase tracking-[0.2em] px-3 py-3 mt-4 opacity-50">
        Projects
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
        {projects.map(project => (
          <div
            key={project.id}
            onClick={() => router.push(`/dashboard/projects/${project.id}`)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-bold transition-all duration-300 w-full text-left group cursor-pointer",
              projectId === project.id
                ? "bg-white shadow-sm ring-1 ring-[#e5e5ea] text-[#1d1d1f]"
                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
            )}
          >
            {/* Color dot/Icon */}
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: project.color }}
            />
            <span className="truncate flex-1">{project.name}</span>
            
            <div className="flex items-center gap-1.5 ml-auto">
                {/* Task count badge */}
                <span className={cn(
                    "text-[9px] font-black px-1.5 py-0.5 rounded-md transition-colors",
                    projectId === project.id 
                        ? "bg-[#0071e3] text-white" 
                        : "bg-[#f5f5f7] text-[#86868b] group-hover:bg-[#e5e5ea]"
                )}>
                  {project.task_count ?? 0}
                </span>

                {/* Delete button - Manager only */}
                {userRole === 'manager' && (
                    <button
                        onClick={(e) => handleDeleteClick(e, project.id, project.name)}
                        className="p-1.5 rounded-lg hover:bg-[#ff3b30]/10 text-[#86868b] hover:text-[#ff3b30] opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
          </div>
        ))}

        {projects.length === 0 && (
            <div className="px-3 py-2 text-[10px] text-[#86868b] italic">
                No projects yet
            </div>
        )}
      </div>

      {/* Create new project - Only for managers */}
      {userRole === 'manager' && (
        <button
          onClick={() => router.push('/dashboard/projects/new')}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-black text-[#86868b] hover:text-[#0071e3] transition-all duration-300 mt-2 group uppercase tracking-widest"
        >
          <div className="w-5 h-5 rounded-lg bg-[#f5f5f7] flex items-center justify-center group-hover:bg-[#0071e3]/10 transition-colors">
              <Plus size={14} />
          </div>
          New project
        </button>
      )}

      <ConfirmationModal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Confirm Project Deletion"
        description={
            <>
                Permanently delete <span className="text-[#1d1d1f] font-black underline decoration-[#ff3b30]/30">"{projectToDelete?.name}"</span>? 
                <br />
                <span className="text-[11px] mt-2 block">Tasks will be moved to the Main Project.</span>
            </>
        }
        confirmText="Delete Project"
        isLoading={isDeleting}
      />
    </div>
  )
}
