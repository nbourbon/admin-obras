import { createContext, useContext, useState, useEffect } from 'react'
import { projectsAPI } from '../api/client'
import { useAuth } from './AuthContext'

const ProjectContext = createContext(null)

const PREFERENCE_KEY = 'projectSelectionPreference'
const LAST_PROJECT_KEY = 'currentProjectId'

export function ProjectProvider({ children }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [isProjectAdmin, setIsProjectAdmin] = useState(false)
  const [currencyMode, setCurrencyMode] = useState('DUAL')
  const [loading, setLoading] = useState(true)
  const [showProjectSelector, setShowProjectSelector] = useState(false)

  useEffect(() => {
    if (user) {
      loadProjects()
    } else {
      setProjects([])
      setCurrentProject(null)
      setIsProjectAdmin(false)
      setCurrencyMode('DUAL')
      setLoading(false)
      setShowProjectSelector(false)
    }
  }, [user])

  const getPreference = () => {
    return localStorage.getItem(PREFERENCE_KEY) || 'last'
  }

  const setPreference = (pref) => {
    localStorage.setItem(PREFERENCE_KEY, pref)
  }

  const loadProjects = async () => {
    try {
      const response = await projectsAPI.list()
      const projectsList = response.data
      setProjects(projectsList)

      const preference = getPreference()
      const savedProjectId = localStorage.getItem(LAST_PROJECT_KEY)

      if (projectsList.length === 0) {
        // No projects, show selector to create one
        setShowProjectSelector(true)
        setCurrentProject(null)
        setIsProjectAdmin(false)
        setCurrencyMode('DUAL')
      } else if (!savedProjectId) {
        // First time login or no saved project - always show selector
        setShowProjectSelector(true)
        applyProject(projectsList[0])
      } else if (preference === 'selector') {
        // User prefers to always see selector
        setShowProjectSelector(true)
        const savedProject = projectsList.find(p => p.id === parseInt(savedProjectId))
        if (savedProject) {
          applyProject(savedProject)
        } else {
          applyProject(projectsList[0])
          localStorage.setItem(LAST_PROJECT_KEY, projectsList[0].id.toString())
        }
      } else {
        // 'last' preference - auto-select last project
        setShowProjectSelector(false)
        const savedProject = projectsList.find(p => p.id === parseInt(savedProjectId))
        if (savedProject) {
          applyProject(savedProject)
        } else {
          applyProject(projectsList[0])
          localStorage.setItem(LAST_PROJECT_KEY, projectsList[0].id.toString())
        }
      }
    } catch (err) {
      console.error('Error loading projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const applyProject = (project) => {
    setCurrentProject(project)
    setIsProjectAdmin(project.current_user_is_admin || false)
    setCurrencyMode(project.currency_mode || 'DUAL')
  }

  const selectProject = (projectId) => {
    const project = projects.find(p => p.id === parseInt(projectId))
    if (project) {
      applyProject(project)
      localStorage.setItem(LAST_PROJECT_KEY, project.id.toString())
    }
  }

  const openProjectSelector = () => {
    setShowProjectSelector(true)
  }

  const closeProjectSelector = () => {
    // Only close if we have a project selected
    if (currentProject) {
      setShowProjectSelector(false)
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
        isProjectAdmin,
        currencyMode,
        loading,
        selectProject,
        refreshProjects,
        showProjectSelector,
        openProjectSelector,
        closeProjectSelector,
        getPreference,
        setPreference,
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
