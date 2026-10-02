import { createClient } from '@supabase/supabase-js'
import {
  itemsSeed,
  customersSeed,
  ordersSeed,
  expensesSeed,
  usersSeed,
  businessProfileSeed
} from '../src/data/mockData.js'

const supabaseUrl = 'http://localhost:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk8MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function main() {
  console.log('Starting Supabase database seeding...')

  // 1. Clean up existing users in auth.users by email match
  console.log('Cleaning up existing auth users...')
  const { data: { users: existingUsers }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Error listing auth users:', listError)
    process.exit(1)
  }

  for (const eu of existingUsers) {
    console.log(`Deleting auth user: ${eu.email}`)
    const { error: delError } = await supabase.auth.admin.deleteUser(eu.id)
    if (delError) {
      console.warn(`Could not delete user ${eu.email}:`, delError.message)
    }
  }

  // 2. Create users in auth.users and public.users
  console.log('Seeding users...')
  const userMapping = {} // mock ID -> auth UUID
  for (const user of usersSeed) {
    console.log(`Creating auth user: ${user.email} with password: ${user.password}`)
    const { data: { user: createdAuthUser }, error: createError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true
    })

    if (createError) {
      console.error(`Failed to create auth user ${user.email}:`, createError.message)
      process.exit(1)
    }

    userMapping[user.id] = createdAuthUser.id

    const { error: insertUserError } = await supabase.from('users').insert({
      id: createdAuthUser.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      last_login: user.lastLogin
    })

    if (insertUserError) {
      console.error(`Failed to insert public user profile for ${user.email}:`, insertUserError.message)
      process.exit(1)
    }
  }

  // 3. Seed Items
  console.log('Seeding items...')
  const mappedItems = itemsSeed.map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    color: item.color,
    material: item.material,
    size: item.size,
    cost: item.cost,
    rent_price: item.rentPrice,
    status: item.status,
    condition: item.condition,
    added_on: item.addedOn
  }))
  
  const { error: itemsError } = await supabase.from('items').insert(mappedItems)
  if (itemsError) {
    console.error('Error inserting items:', itemsError.message)
    process.exit(1)
  }

  // 4. Seed Customers
  console.log('Seeding customers...')
  const mappedCustomers = customersSeed.map(c => ({
    id: c.id,
    first_name: c.firstName,
    last_name: c.lastName,
    nic: c.nic || null,
    email: c.email || null,
    phone: c.phone,
    phone2: c.phone2 || null,
    address: c.address,
    created_on: c.createdOn
  }))

  const { error: customersError } = await supabase.from('customers').insert(mappedCustomers)
  if (customersError) {
    console.error('Error inserting customers:', customersError.message)
    process.exit(1)
  }

  // 5. Seed Orders
  console.log('Seeding orders...')
  const mappedOrders = ordersSeed.map(o => ({
    invoice: o.invoice,
    customer_id: o.customer,
    order_date: o.orderDate,
    items: o.items,
    start_date: o.startDate,
    end_date: o.endDate,
    total_amount: o.totalAmount,
    payment_received: o.paymentReceived,
    remaining_payment: o.remainingPayment,
    payment_method: o.paymentMethod,
    status: o.status,
    dry_clean: o.dryClean,
    pickup_mode: o.pickupMode,
    remark: o.remark || null
  }))

  const { error: ordersError } = await supabase.from('orders').insert(mappedOrders)
  if (ordersError) {
    console.error('Error inserting orders:', ordersError.message)
    process.exit(1)
  }

  // 6. Seed Expenses
  console.log('Seeding expenses...')
  const mappedExpenses = expensesSeed.map(e => ({
    id: e.id,
    date: e.date,
    category: e.category,
    amount: e.amount,
    paid_by: e.paidBy,
    note: e.note || null
  }))

  const { error: expensesError } = await supabase.from('expenses').insert(mappedExpenses)
  if (expensesError) {
    console.error('Error inserting expenses:', expensesError.message)
    process.exit(1)
  }

  // 7. Seed Business Profile
  console.log('Seeding business profile...')
  const mappedProfile = {
    id: 1,
    name: businessProfileSeed.name,
    tagline: businessProfileSeed.tagline || null,
    reg_no: businessProfileSeed.regNo || null,
    tax_id: businessProfileSeed.taxId || null,
    currency: businessProfileSeed.currency,
    phone: businessProfileSeed.phone || null,
    email: businessProfileSeed.email || null,
    address: businessProfileSeed.address || null,
    late_fee_per_day: businessProfileSeed.lateFeePerDay
  }

  const { error: profileError } = await supabase.from('business_profile').insert(mappedProfile)
  if (profileError) {
    console.error('Error inserting business profile:', profileError.message)
    process.exit(1)
  }

  console.log('Database seeding completed successfully!');
}

main().catch(err => {
  console.error('Fatal seeding error:', err)
  process.exit(1)
})
