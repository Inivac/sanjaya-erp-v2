import { useEffect, useState } from 'react'
import { Save, Tag, Trash2, Plus, Printer, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { PageHeader, Card, Button, Field, Input, Textarea, Select } from '../components/ui/Primitives.jsx'
import { supabase } from '../utils/supabaseClient.js'

export default function Settings() {
  const { businessProfile, setBusinessProfile, itemCategories, addItemCategory, deleteItemCategory } = useApp()
  const confirm = useConfirm()
  const [form, setForm] = useState(businessProfile || {})
  const [expCats, setExpCats] = useState([])
  const [loadingExpCats, setLoadingExpCats] = useState(true)
  const [isAddingItemCat, setIsAddingItemCat] = useState(false)
  const [isAddingExpCat, setIsAddingExpCat] = useState(false)
  const [newItemCat, setNewItemCat] = useState('')
  const [newExpCat, setNewExpCat] = useState('')
  const [saved, setSaved] = useState(false)
  const [appearance, setAppearance] = useState(localStorage.getItem('erp_appearance') || 'light')
  const [notificationsEnabled, setNotificationsEnabled] = useState(localStorage.getItem('erp_notifications_enabled') !== 'false')

  const isElectron = typeof window !== 'undefined' && typeof window.require === 'function'
  const [printers, setPrinters] = useState([])
  const [selectedPrinter, setSelectedPrinter] = useState(() => localStorage.getItem('erp_pos_printer') || businessProfile?.posPrinter || '')
  const [silentPrint, setSilentPrint] = useState(() => localStorage.getItem('erp_silent_print') !== 'false')
  const [printerStatus, setPrinterStatus] = useState(null)
  const [testingPrint, setTestingPrint] = useState(false)

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('expense_categories').select('*').order('name')
      if (data) setExpCats(data)
      setLoadingExpCats(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (businessProfile) {
      setForm(businessProfile)
      if (businessProfile.posPrinter) {
        setSelectedPrinter(businessProfile.posPrinter)
        localStorage.setItem('erp_pos_printer', businessProfile.posPrinter)
      }
    }
  }, [businessProfile])

  useEffect(() => {
    const root = document.documentElement
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldUseDark = appearance === 'dark' || (appearance === 'system' && prefersDark)
    root.classList.toggle('theme-dark', shouldUseDark)
    localStorage.setItem('erp_appearance', appearance)
  }, [appearance])

  useEffect(() => {
    localStorage.setItem('erp_notifications_enabled', String(notificationsEnabled))
  }, [notificationsEnabled])

  function loadPrinters() {
    if (isElectron) {
      try {
        const { ipcRenderer } = window.require('electron')
        ipcRenderer.invoke('get-printers').then(list => {
          if (Array.isArray(list)) {
            setPrinters(list)
            const currentSaved = localStorage.getItem('erp_pos_printer') || businessProfile?.posPrinter
            if (!currentSaved) {
              const def = list.find(p => p.isDefault) || list[0]
              if (def) setSelectedPrinter(def.name)
            } else {
              setSelectedPrinter(currentSaved)
            }
          }
        }).catch(err => console.warn(err))
      } catch (e) {
        console.warn(e)
      }
    }
  }

  useEffect(() => {
    loadPrinters()
  }, [isElectron])

  async function handleTestPrint() {
    setTestingPrint(true)
    setPrinterStatus(null)
    try {
      const targetPrinter = (selectedPrinter && selectedPrinter !== '__dialog__')
        ? selectedPrinter
        : (printers[0]?.name || businessProfile?.posPrinter || 'Xprinter XP-80')

      // Save selected printer to business_profile table in Supabase
      try {
        const { error: dbErr } = await supabase
          .from('business_profile')
          .update({ pos_printer: targetPrinter })
          .eq('id', 1)

        if (dbErr) {
          console.error('Failed to update pos_printer in business_profile:', dbErr)
        } else {
          localStorage.setItem('erp_pos_printer', targetPrinter)
          setBusinessProfile(prev => ({ ...prev, posPrinter: targetPrinter }))
        }
      } catch (dbErr) {
        console.error('Error saving pos_printer to database:', dbErr)
      }

      if (isElectron) {
        const { ipcRenderer } = window.require('electron')

        const testSlip = [
          '==========================================',
          '       SANJAYA PROFESSIONAL TAILORS       ',
          '           PRINTER TEST RECEIPT           ',
          '==========================================',
          'Date   : ' + new Date().toLocaleString('en-GB'),
          'Printer: ' + targetPrinter,
          'Status : Connection OK - Ready to Print',
          '------------------------------------------',
          '1234567890 1234567890 1234567890 1234567890',
          '------------------------------------------',
          '       Software Powered by Inivac         ',
          '==========================================',
          '\n\n\n'
        ].join('\n')

        const result = await ipcRenderer.invoke('print-text-receipt', {
          text: testSlip,
          printerName: targetPrinter,
        })

        if (result && !result.success) {
          throw new Error(result.failureReason || 'Failed to print test slip')
        }
        setPrinterStatus({ type: 'success', message: `Saved printer to database & test receipt printed to ${targetPrinter}!` })
      } else {
        setPrinterStatus({ type: 'success', message: `Saved "${targetPrinter}" to database.` })
        window.print()
      }
    } catch (err) {
      setPrinterStatus({ type: 'error', message: `Test print failed: ${err.message}` })
    } finally {
      setTestingPrint(false)
      setTimeout(() => setPrinterStatus(null), 5000)
    }
  }

  async function handleAddExpCategory() {
    const val = newExpCat.trim()
    if (!val) return
    setIsAddingExpCat(true)
    const { data, error } = await supabase.from('expense_categories').insert({ name: val }).select().single()
    setIsAddingExpCat(false)
    if (error) {
      alert(`Failed to add expense category: ${error.message}`)
    } else if (data) {
      setExpCats((prev) => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)))
      setNewExpCat('')
    }
  }

  async function handleDeleteExpCategory(id) {
    const category = expCats.find(c => c.id === id)
    if (!category) return
    
    const ok = await confirm({
      title: 'Delete this expense category?',
      message: `"${category.name}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete Category',
      tone: 'danger',
    })
    
    if (!ok) return
    
    const { error } = await supabase.from('expense_categories').delete().eq('id', id)
    if (error) {
      alert(`Failed to delete expense category: ${error.message}`)
    } else {
      setExpCats((prev) => prev.filter(c => c.id !== id))
    }
  }

  async function handleAddItemCategory() {
    const val = newItemCat.trim()
    if (!val) return
    setIsAddingItemCat(true)
    try {
      await addItemCategory(val)
      setNewItemCat('')
    } catch (err) {
      alert(`Failed to add item category: ${err.message}`)
    } finally {
      setIsAddingItemCat(false)
    }
  }

  async function handleDeleteItemCategory(id) {
    const category = itemCategories.find(c => c.id === id)
    if (!category) return
    
    const ok = await confirm({
      title: 'Delete this item category?',
      message: `"${category.name}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete Category',
      tone: 'danger',
    })
    
    if (!ok) return
    
    try {
      await deleteItemCategory(id)
    } catch (err) {
      alert(`Failed to delete item category: ${err.message}`)
    }
  }

  function save(e) {
    e.preventDefault()
    setBusinessProfile({ ...form, posPrinter: selectedPrinter || form.posPrinter })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Business profile, categories and system preferences."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 font-display text-base font-semibold text-ink">Business Profile</h3>
          <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Business Name" className="sm:col-span-2">
              <Input value={form?.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Tagline" className="sm:col-span-2">
              <Input value={form?.tagline || ''} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} />
            </Field>
            <Field label="Business Registration No.">
              <Input value={form?.regNo || ''} onChange={e => setForm(f => ({ ...f, regNo: e.target.value }))} />
            </Field>
            <Field label="Tax / VAT ID">
              <Input value={form?.taxId || ''} onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))} />
            </Field>

            <Field label="Phone">
              <Input value={form?.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form?.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Textarea value={form?.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </Field>
            <Field label="Currency">
              <Input value={form?.currency || ''} disabled />
            </Field>
            <Field label="Late Return Fee (per day, LKR)">
              <Input type="number" min="0" value={form?.lateFeePerDay || ''} onChange={e => setForm(f => ({ ...f, lateFeePerDay: Number(e.target.value) }))} />
            </Field>

            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" variant="brass" icon={Save}>Save Changes</Button>
              {saved && <span className="text-xs font-medium text-sage">Saved ✓</span>}
            </div>
          </form>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-ink"><Tag size={16} className="text-brass-dark" /> Item Categories</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {itemCategories.length === 0 ? (
                <span className="text-xs text-muted">No item categories available.</span>
              ) : (
                itemCategories.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink">
                    {c.name}
                    <button onClick={() => handleDeleteItemCategory(c.id)} title="Delete category" className="text-muted hover:text-burgundy"><Trash2 size={11} /></button>
                  </span>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input value={newItemCat} onChange={e => setNewItemCat(e.target.value)} placeholder="New category" />
              <Button variant="outline" icon={Plus} disabled={isAddingItemCat || !newItemCat.trim()} onClick={handleAddItemCategory}>
                Add
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-ink"><Tag size={16} className="text-brass-dark" /> Expense Categories</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {loadingExpCats ? (
                <span className="text-xs text-muted">Loading…</span>
              ) : expCats.length === 0 ? (
                <span className="text-xs text-muted">No expense categories added.</span>
              ) : (
                expCats.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink">
                    {c.name}
                    <button onClick={() => handleDeleteExpCategory(c.id)} title="Delete category" className="text-muted hover:text-burgundy"><Trash2 size={11} /></button>
                  </span>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input value={newExpCat} onChange={e => setNewExpCat(e.target.value)} placeholder="New category" />
              <Button variant="outline" icon={Plus} disabled={isAddingExpCat || !newExpCat.trim()} onClick={handleAddExpCategory}>
                Add
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-display text-base font-semibold text-ink">Appearance &amp; Notifications</h3>
            <div className="space-y-3">
              <Field label="Theme / Appearance">
                <Select value={appearance} onChange={e => setAppearance(e.target.value)}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </Select>
              </Field>
              <label className="flex items-center justify-between rounded-lg border border-line bg-paper/50 px-3 py-2 text-sm">
                <span className="text-ink">Enable topbar notifications</span>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={e => setNotificationsEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[#B8863B]"
                />
              </label>
              <p className="text-xs text-muted">These preferences are saved in your browser for this workspace.</p>
            </div>
          </Card>

          {/* POS Receipt Printer Card */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                <Printer size={16} className="text-brass-dark" /> POS Receipt Printer
              </h3>
              {isElectron && (
                <button
                  type="button"
                  onClick={loadPrinters}
                  className="rounded p-1 text-muted hover:bg-line/60 hover:text-ink transition-colors"
                  title="Refresh detected printers"
                >
                  <RefreshCw size={13} />
                </button>
              )}
            </div>

            {isElectron ? (
              <div className="space-y-3">
                <Field label="Target Printer">
                  <Select
                    value={selectedPrinter}
                    onChange={e => {
                      setSelectedPrinter(e.target.value)
                      localStorage.setItem('erp_pos_printer', e.target.value)
                    }}
                  >
                    <option value="">Default Windows Printer</option>
                    {selectedPrinter && selectedPrinter !== '__dialog__' && !printers.some(p => p.name === selectedPrinter) && (
                      <option value={selectedPrinter}>{selectedPrinter}</option>
                    )}
                    {printers.map(p => (
                      <option key={p.name} value={p.name}>
                        {p.name} {p.isDefault ? '(System Default)' : ''}
                      </option>
                    ))}
                    <option value="__dialog__">Always Show Print Dialog</option>
                  </Select>
                </Field>

                <label className="flex items-center justify-between rounded-lg border border-line bg-paper/50 px-3 py-2 text-sm cursor-pointer">
                  <span className="text-ink">Direct 1-Click Silent Print</span>
                  <input
                    type="checkbox"
                    checked={silentPrint}
                    onChange={e => {
                      setSilentPrint(e.target.checked)
                      localStorage.setItem('erp_silent_print', String(e.target.checked))
                    }}
                    className="h-4 w-4 accent-[#B8863B]"
                  />
                </label>

                <p className="text-xs text-muted">
                  Receipts format at standard 80mm roll width with 0mm margins to prevent clipped or misaligned text.
                </p>

                {printerStatus && (
                  <div className={`rounded p-2 text-xs font-medium ${printerStatus.type === 'error' ? 'bg-burgundy-50 text-burgundy' : 'bg-sage-50 text-sage'}`}>
                    {printerStatus.message}
                  </div>
                )}

                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Printer}
                    disabled={testingPrint}
                    onClick={handleTestPrint}
                    className="w-full justify-center"
                  >
                    {testingPrint ? 'Sending Test…' : 'Print Test Slip'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted space-y-2">
                <p>When running in a standard web browser, print jobs use your browser's native print dialog.</p>
                <p>To configure direct thermal receipt printers and 1-click silent printing, use the Electron desktop application.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
