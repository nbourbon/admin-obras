import { createContext, useContext, useState, useEffect } from 'react'
import { projectsAPI } from '../api/client'
import { useAuth } from './AuthContext'

const ProjectContext = createContext(null)

export function ProjectProvider({ children }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadProjects()
    } else {
      setProjects([])
      setCurrentProject(null)
      setLoading(false)
    }
  }, [user])

  const loadProjects = async () => {
    try {
      const response = await projectsAPI.list()
      const projectsList = response.data
      setProjects(projectsList)

      // Try to restore last selected project from localStorage
      const savedProjectId = localStorage.getItem('currentProjectId')
      if (savedProjectId) {
        const savedProject = projectsList.find(p => p.id === parseInt(savedProjectId))
        if (savedProject) {
          setCurrentProject(savedProject)
        } else if (projectsList.length > 0) {
          // Saved project not found, use first available
          setCurrentProject(projectsList[0])
          localStorage.setItem('currentProjectId', projectsList[0].id.toString())
        }
      } else if (projectsList.length > 0) {
        // No saved project, use first available
        setCurrentProject(projectsList[0])
        localStorage.setItem('currentProjectId', projectsList[0].id.toString())
      }
    } catch (err) {
      console.error('Error loading projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectProject = (projectId) => {
    const project = projects.find(p => p.id === parseInt(projectId))
    if (project) {
      setCurrentProject(project)
      localStorage.setItem('currentProjectId', project.id.toString())
    }
  }

  const refreshProjects = async () => {
    await loadProjects()
  }

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        loading,
        selectProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}
