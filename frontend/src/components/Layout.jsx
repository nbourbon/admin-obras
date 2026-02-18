import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
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
} from 'lucide-react'
import { useState } from 'react'

function Layout() {
  const { user, logout } = useAuth()
  const { projects, currentProject, isProjectAdmin, selectProject, loading: projectsLoading } = useProject()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isIndividual = currentProject?.is_individual

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/expenses', icon: Receipt, label: 'Gastos' },
    { to: '/my-payments', icon: CreditCard, label: 'Mis Pagos' },
    { to: '/notes', icon: FileText, label: 'Notas' },
    { to: '/projects', icon: Briefcase, label: 'Proyectos' },
  ]

  const adminItems = [
    // Hide "Por Aprobar" for individual projects (auto-approved)
    ...(!isIndividual ? [{ to: '/pending-approvals', icon: ClipboardCheck, label: 'Por Aprobar' }] : []),
    { to: '/project-members', icon: Users, label: 'Participantes' },
    { to: '/providers', icon: Building2, label: 'Proveedores' },
    { to: '/categories', icon: FolderOpen, label: 'Categorias' },
  ]

  const NavItem = ({ to, icon: Icon, label }) => (
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
      <span>{label}</span>
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
        <div className="h-full flex flex-col">
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

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}

            {isProjectAdmin && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-4 text-xs font-semibold text-gray-400 uppercase">
                    Admin
                  </p>
                </div>
                {adminItems.map((item) => (
                  <NavItem key={item.to} {...item} />
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
          <h1 className="text-xl font-bold text-blue-600 truncate">{currentProject?.name || 'Tus Proyectos'}</h1>
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
