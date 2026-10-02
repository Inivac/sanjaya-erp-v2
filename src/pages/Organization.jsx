import { useState } from 'react'
import { Plus, Trash2, ShieldCheck } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { ROLES } from '../data/mockData.js'
import { PageHeader, Card, Button, Modal, Field, Input, Select } from '../components/ui/Primitives.jsx'
import Badge from '../components/ui/Badge.jsx'
import { initials } from '../utils/format.js'

const emptyForm = { name: '', email: '', password: '', role: 'user' }

const ROLE_PERMISSIONS = {
  Admin: 'Full access — inventory, orders, accounting, users & settings',
  user: 'Standard access for day-to-day operations and order management',
  Laundry: 'Restricted access — can only view and update dry cleaning statuses',
}

export default function Organization() {
  const { users, addUser, updateUser, deleteUser, businessProfile } = useApp()
  const confirm = useConfirm()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const adminCount = users.filter(u => u.role === 'Admin').length

  async function submit(e) {
    e.preventDefault()
    try {
      await addUser(form)
      setModalOpen(false)
      setForm(emptyForm)
    } catch (err) {
      alert(`Failed to invite user: ${err.message}`)
    }
  }

  async function handleRoleChange(user, newRole) {
    if (newRole === user.role) return
    const ok = await confirm({
      title: 'Change this user\'s role?',
      message: `${user.name}'s role will change from "${user.role}" to "${newRole}", which changes what they can access.`,
      confirmLabel: 'Change Role',
      tone: 'default',
    })
    if (ok) {
      try {
        await updateUser(user.id, { role: newRole })
      } catch (err) {
        alert(`Failed to change role: ${err.message}`)
      }
    }
  }

  async function handleDelete(user) {
    const ok = await confirm({
      title: 'Remove this team member?',
      message: `${user.name} (${user.email}) will lose access to this workspace immediately. This cannot be undone.`,
      confirmLabel: 'Remove User',
      tone: 'danger',
    })
    if (ok) {
      try {
        await deleteUser(user.id)
      } catch (err) {
        alert(`Failed to remove user: ${err.message}`)
      }
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Organization"
        description="Manage team members and their roles."
        actions={<Button variant="brass" icon={Plus} onClick={() => setModalOpen(true)}>Invite User</Button>}
      />

      <div className="space-y-5">
        <div>
          <h3 className="mb-3 font-display text-base font-semibold text-ink">Team Members</h3>
          <Card className="overflow-hidden">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-t border-line/60 hover:bg-paper/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{initials(u.name)}</div>
                          <div>
                            <p className="font-medium text-ink">{u.name}</p>
                            <p className="text-xs text-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u, e.target.value)}
                          className="rounded-lg border border-line bg-white px-2 py-1 text-xs focus:border-brass focus:outline-none"
                        >
                          {ROLES.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3"><Badge>{u.status}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={u.role === 'Admin' && adminCount < 2}
                          className="rounded-lg p-1.5 text-muted hover:bg-burgundy-50 hover:text-burgundy disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted"
                          title={u.role === 'Admin' && adminCount < 2 ? "Cannot remove the last admin" : undefined}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <h3 className="mb-3 mt-6 font-display text-base font-semibold text-ink">Role Permissions</h3>
          <Card className="divide-y divide-line">
            {ROLES.map(r => (
              <div key={r} className="flex items-start gap-3 px-4 py-3">
                <ShieldCheck size={16} className="mt-0.5 text-brass-dark" />
                <div>
                  <p className="text-sm font-medium text-ink">{r}</p>
                  <p className="text-xs text-muted">{ROLE_PERMISSIONS[r]}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Invite Team Member">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full Name" required>
            <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password" required>
            <Input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="New user's password" />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brass">Send Invite</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
