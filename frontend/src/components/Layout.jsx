import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { notesAPI, paymentsAPI, contributionsAPI } from '../api/client'
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Users,
  Building2,
  FolderOpen,
  LogOut,
  Menu,
  X,
  ClipboardCheck,
  Briefcase,
  ChevronDown,
  FileText,
  TrendingUp,
  HardHat,
} from 'lucide-react'
import { useState, useEffect } from 'react'

function Layout() {
  const { user, logout } = useAuth()
  const { projects, currentProject, isProjectAdmin, selectProject, loading: projectsLoading } = useProject()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadNotesCount, setUnreadNotesCount] = useState(0)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)
  const [myContributionsCount, setMyContributionsCount] = useState(0)

  useEffect(() => {
    if (currentProject) {
      loadUnreadCount()
      loadPendingApprovalsCount()
      loadMyContributionsCount()
    }
  }, [currentProject])

  // Reload counts when returning from respective pages
  useEffect(() => {
    // Reload notes count when not on notes page
    if (!pathname.startsWith('/notes/') && pathname !== '/notes') {
      loadUnreadCount()
    }
    // Reload pending approvals count when not on pending-approvals page
    if (!pathname.startsWith('/pending-approvals')) {
      loadPendingApprovalsCount()
    }
    // Reload contributions count when not on contributions page
    if (!pathname.startsWith('/contributions')) {
      loadMyContributionsCount()
    }
  }, [pathname])

  const loadUnreadCount = async () => {
    try {
      const response = await notesAPI.unreadCount()
      setUnreadNotesCount(response.data.unread_count)
    } catch (err) {
      console.error('Error loading unread notes count:', err)
    }
  }

  const loadPendingApprovalsCount = async () => {
    if (!isProjectAdmin) return
    try {
      const response = await paymentsAPI.pendingApprovalCount()
      setPendingApprovalsCount(response.data.count)
    } catch (err) {
      console.error('Error loading pending approvals count:', err)
    }
  }

  const loadMyContributionsCount = async () => {
    try {
      const response = await contributionsAPI.getMyPendingCount()
      setMyContributionsCount(response.data.count)
    } catch (err) {
      console.error('Error loading my contributions count:', err)
    }
  }

  const getSectionName = () => {
    if (pathname.startsWith('/dashboard')) return 'Dashboard'
    if (pathname.startsWith('/expenses')) return 'Gastos'
    if (pathname.startsWith('/contributions')) return 'Aportes'
    if (pathname.startsWith('/notes')) return 'Notas'
    if (pathname.startsWith('/projects')) return 'Proyectos'
    if (pathname.startsWith('/project-members')) return 'Participantes'
    if (pathname.startsWith('/pending-approvals')) return 'Por Aprobar'
    if (pathname.startsWith('/providers')) return 'Proveedores'
    if (pathname.startsWith('/categories')) return 'Categorías'
    if (pathname.startsWith('/rubros')) return 'Rubros'
    if (pathname.startsWith('/avance-obra')) return 'Avance de Obra'
    return currentProject?.name || 'Tus Proyectos'
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isIndividual = currentProject?.is_individual
  const contributionMode = currentProject?.type_parameters?.contribution_mode || 'both'

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/expenses', icon: Receipt, label: 'Gastos' },
    // Hide "Aportes" if contribution_mode is "direct_payment"
    ...(contributionMode !== 'direct_payment' ? [{ to: '/contributions', icon: TrendingUp, label: 'Aportes' }] : []),
    { to: '/notes', icon: FileText, label: 'Notas' },
    { to: '/projects', icon: Briefcase, label: 'Proyectos' },
  ]

  const adminItems = [
    // Hide "Por Aprobar" for individual projects (auto-approved)
    ...(!isIndividual ? [{ to: '/pending-approvals', icon: ClipboardCheck, label: 'Por Aprobar' }] : []),
    { to: '/project-members', icon: Users, label: 'Participantes' },
    { to: '/providers', icon: Building2, label: 'Proveedores' },
    { to: '/categories', icon: FolderOpen, label: 'Categorias' },
    { to: '/rubros', icon: Briefcase, label: 'Rubros' },
    ...(currentProject?.project_type === 'construccion'
      ? [{ to: '/avance-obra', icon: HardHat, label: 'Avance de Obra' }]
      : []),
  ]

  const NavItem = ({ to, icon: Icon, label, badge = 0 }) => (
    <NavLink
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`
      }
    >
      <Icon size={20} />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </NavLink>
  )

  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform duration-200 ease-in-out`}
      >
        <div className="h-full flex flex-col overflow-y-auto">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-blue-600">Tus Proyectos</h1>
              <button
                className="lg:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={24} />
              </button>
            </div>

            {/* Project Selector */}
            {projects.length > 0 && (
              <div className="relative">
                <select
                  value={currentProject?.id || ''}
                  onChange={(e) => {
                    selectProject(e.target.value)
                    // Reload page to refresh data with new project
                    window.location.reload()
                  }}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            )}
            {projects.length === 0 && !projectsLoading && (
              <p className="text-sm text-gray-500">Sin proyectos</p>
            )}
          </div>

          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                badge={
                  item.to === '/notes' ? unreadNotesCount :
                  item.to === '/contributions' ? myContributionsCount :
                  0
                }
              />
            ))}

            {isProjectAdmin && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-4 text-xs font-semibold text-gray-400 uppercase">
                    Admin
                  </p>
                </div>
                {adminItems.map((item) => (
                  <NavItem 
                    key={item.to} 
                    {...item} 
                    badge={item.to === '/pending-approvals' ? pendingApprovalsCount : 0}
                  />
                ))}
              </>
            )}
          </nav>

          <div className="p-4 border-t" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="mb-3 px-4">
              <p className="font-medium text-gray-900">{user?.full_name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              {user?.participation_percentage > 0 && (
                <p className="text-sm text-blue-600">
                  {user.participation_percentage}% participacion
                </p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2 w-full text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span>Cerrar sesion</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden bg-white border-b px-4 py-4 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="p-1">
            <Menu size={28} />
          </button>
          <h1 className="text-xl font-bold text-gray-900 truncate">{getSectionName()}</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
