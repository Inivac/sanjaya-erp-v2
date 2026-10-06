// Dummy / seed data for Sanyaja Professional Tailors ERP
// All monetary values are in LKR (Sri Lankan Rupees)

// Item categories are now loaded from the item_categories DB table
export const ITEM_CATEGORIES = ['Coat', 'Trouser', 'Vest', 'National', 'Shirt', 'Accessory']

// Items seed data (matches new schema: no rentPrice/condition/addedOn, status is boolean)
export const itemsSeed = [
  { coatNo: 'C-2858', name: 'Black & Red Coat', color: '#111111', material: 'Wool Blend', size: '40R', cost: 18500, status: true },
  { coatNo: 'C-2857', name: 'Cream Vest', color: '#E8DCC0', material: 'Cotton Twill', size: 'M', cost: 4200, status: true },
  { coatNo: 'C-2856', name: 'Cream Trouser', color: '#E8DCC0', material: 'Cotton Twill', size: '34', cost: 6100, status: true },
  { coatNo: 'C-2692', name: 'Charcoal Slim Coat', color: '#2E2E33', material: 'Wool', size: '42R', cost: 21000, status: true },
  { coatNo: 'C-2694', name: 'Charcoal Trouser', color: '#2E2E33', material: 'Wool', size: '36', cost: 6800, status: true },
  { coatNo: 'C-2277', name: 'Classic Black Coat', color: '#0E0E0E', material: 'Wool', size: '40R', cost: 22000, status: true },
]

export const customersSeed = [
  { id: 'C0001', firstName: 'Prabath', lastName: 'Perera', nic: '199022013456', email: 'prabath.p@gmail.com', phone: '0719677782', phone2: '', address: 'Buththala, Monaragala', createdOn: '2026-03-11' },
  { id: 'C0002', firstName: 'Nipun', lastName: 'Silva', nic: '199534501234', email: 'nipun.silva@gmail.com', phone: '0779516055', phone2: '0112345678', address: 'Aloka 8, Milla Post, Madagama', createdOn: '2026-04-02' },
  { id: 'C0003', firstName: 'Dammika', lastName: 'Wijesinghe', nic: '882922391V', email: '', phone: '0771727249', phone2: '', address: 'Nugegoda, Colombo', createdOn: '2026-02-19' },
  { id: 'C0004', firstName: 'Sameera', lastName: 'Ayya', nic: '921583354V', email: 'sameera.a@yahoo.com', phone: '0764406667', phone2: '', address: 'Kandy Road, Kadawatha', createdOn: '2026-01-05' },
  { id: 'C0005', firstName: 'Athula', lastName: 'Fernando', nic: '196916000655', email: '', phone: '0718089430', phone2: '', address: 'Galle Road, Panadura', createdOn: '2025-12-22' },
  { id: 'C0006', firstName: 'Lahiru', lastName: 'Jayasuriya', nic: '198930004904', email: 'lahiru.j@gmail.com', phone: '0766690504', phone2: '', address: 'Malabe, Colombo', createdOn: '2026-05-30' },
  { id: 'C0007', firstName: 'Hashan', lastName: 'Sir', nic: '199144502234', email: 'hashan@gmail.com', phone: '0725130000', phone2: '', address: 'Kurunegala Town', createdOn: '2026-06-18' },
]

// Orders seed data updated for new schema
export const ordersSeed = []

export const EXPENSE_CATEGORIES = ['Fabric Purchase', 'Salaries', 'Rent', 'Utilities', 'Maintenance', 'Transport', 'Marketing', 'Dry Cleaning', 'Other']

export const expensesSeed = [
  { id: 'EXP0001', date: '2026-08-01', category: 'Rent', amount: 75000, paidBy: 'Business Account', note: 'Shop rent — August' },
  { id: 'EXP0002', date: '2026-08-03', category: 'Salaries', amount: 145000, paidBy: 'Business Account', note: 'Staff salaries — 3 tailors + 1 assistant' },
  { id: 'EXP0003', date: '2026-08-05', category: 'Fabric Purchase', amount: 62000, paidBy: 'Cash', note: 'Wool fabric bulk order — 40 meters' },
  { id: 'EXP0004', date: '2026-08-08', category: 'Utilities', amount: 18500, paidBy: 'Business Account', note: 'Electricity + water' },
  { id: 'EXP0005', date: '2026-08-11', category: 'Dry Cleaning', amount: 9200, paidBy: 'Cash', note: 'Outsourced dry cleaning — 12 items' },
  { id: 'EXP0006', date: '2026-08-13', category: 'Maintenance', amount: 6400, paidBy: 'Cash', note: 'Sewing machine servicing' },
  { id: 'EXP0007', date: '2026-08-16', category: 'Marketing', amount: 12000, paidBy: 'Business Account', note: 'Facebook & Instagram ads' },
  { id: 'EXP0008', date: '2026-08-19', category: 'Transport', amount: 4300, paidBy: 'Cash', note: 'Delivery to a customer in the same city' },
]

export const usersSeed = [
  { id: 'U0001', name: 'Sanjaya Perera', email: 'sanjaya@sanjayatailors.lk', password: 'admin123', role: 'Admin', status: 'Active', lastLogin: '2026-08-22 10:54 AM' },
  { id: 'U0002', name: 'Ruwani Kumari', email: 'ruwani@sanjayatailors.lk', password: 'manager123', role: 'user', status: 'Active', lastLogin: '2026-08-22 09:20 AM' },
  { id: 'U0003', name: 'Kasun Bandara', email: 'kasun@sanjayatailors.lk', password: 'account123', role: 'user', status: 'Active', lastLogin: '2026-08-21 05:40 PM' },
  { id: 'U0004', name: 'Nadeesha Silva', email: 'nadeesha@sanjayatailors.lk', password: 'staff123', role: 'user', status: 'Active', lastLogin: '2026-08-20 11:05 AM' },
  { id: 'U0005', name: 'Tharindu Fonseka', email: 'tharindu@sanjayatailors.lk', password: 'staff123', role: 'user', status: 'Invited', lastLogin: '—' },
]

export const ROLES = ['Admin', 'user', 'Laundry']

export const businessProfileSeed = {
  name: 'Sanjaya Professional Tailors',
  tagline: 'Tailoring & Professional Suit Rental',
  regNo: 'PV 00248761',
  taxId: '134589207-VAT',
  currency: 'LKR',
  phone: '0112 587 421',
  email: 'info@sanjayatailors.lk',
  address: '142 Galle Road, Colombo 04, Sri Lanka',
  lateFeePerDay: 500,
  posPrinter: 'Xprinter XP-80'
}
