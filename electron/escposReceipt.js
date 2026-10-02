import escpos from 'escpos';

class BufferAdapter {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }
  open(cb) {
    cb && cb();
    return this;
  }
  write(data, cb) {
    this.buffer = Buffer.concat([this.buffer, data]);
    cb && cb();
    return this;
  }
  close(cb) {
    cb && cb();
    return this;
  }
}

export function generateEscposBuffer(data) {
  const { order, customer, orderItems, businessProfile } = data;
  
  const device = new BufferAdapter();
  const printer = new escpos.Printer(device, { encoding: 'GB18030' }); // Supports normal chars

  const invoiceDisplay = order.invoiceNumber || `#${order.id}`;
  const now = new Date();
  const printedDate = now.toLocaleDateString('en-GB');
  const printedTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB') : new Date(order.startDate).toLocaleDateString('en-GB');
  const dueDate = new Date(order.endDate).toLocaleDateString('en-GB');
  const isDryClean = Boolean(order.dryclean_status || order.drycleanStatus);
  
  const rentalDays = Math.max(
    Math.round((new Date(order.endDate).setHours(0,0,0,0) - new Date(order.startDate).setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)),
    1
  );

  const formatLKR = (amount) => {
    let str = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
    return 'Rs.' + str;
  };

  const lineLength = 46; // Tuned for perfect centering on 80mm hardware

  // Helper to cleanly print left-right aligned rows
  const printRow = (left, right, width = lineLength) => {
    const leftStr = (left || '').toString();
    const rightStr = (right || '').toString();
    const spaceCount = width - leftStr.length - rightStr.length;
    
    if (spaceCount > 0) {
      printer.text(leftStr + ' '.repeat(spaceCount) + rightStr);
    } else {
      printer.text(leftStr);
      printer.text(' '.repeat(Math.max(0, width - rightStr.length)) + rightStr);
    }
  };

  printer.align('ct');
  printer.style('b');
  printer.size(0, 1); // Normal width, double height so it fits on one line
  const bName = (businessProfile?.name || 'Sanjaya Professional Tailors').toUpperCase();
  printer.text(bName);
  printer.size(0, 0); // Revert to normal size
  printer.style('normal');
  
  if (businessProfile?.tagline) printer.text(businessProfile.tagline);
  if (businessProfile?.address) printer.text(businessProfile.address.replace(/\n/g, ' '));
  if (businessProfile?.phone) printer.text(`Tel: ${businessProfile.phone}`);
  if (businessProfile?.email) printer.text(businessProfile.email);
  if (businessProfile?.regNo) printer.text(`Reg: ${businessProfile.regNo}`);
  
  printer.text('-'.repeat(lineLength));
  
  printer.align('lt');
  printRow('Receipt No:', invoiceDisplay);
  printRow('Order Date:', orderDate);
  printRow('Due Return:', dueDate);
  printRow('Duration:', `${rentalDays} Day${rentalDays > 1 ? 's' : ''}`);
  printRow('Printed At:', `${printedDate} ${printedTime}`);

  printer.text('-'.repeat(lineLength));
  
  printer.align('ct');
  printer.text('CUSTOMER DETAILS');
  printer.align('lt');
  
  const custName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') : 'Walk-in Customer';
  printRow('Name:', custName);
  
  if (customer?.nic) {
    printRow('NIC No:', customer.nic);
  }
  
  if (customer?.phone || customer?.phone2) {
    const phones = [customer?.phone, customer?.phone2].filter(Boolean).join(' / ');
    printRow('Phone:', phones);
  }
  
  if (customer?.address) {
    printer.text(`Address: ${customer.address}`);
  }

  printer.text('-'.repeat(lineLength));
  printRow('ITEM / DESCRIPTION', 'PRICE');
  printer.text('-'.repeat(lineLength));

  if (orderItems && orderItems.length > 0) {
    orderItems.forEach((d, idx) => {
      const garments = [
        d.coat && { label: 'Coat', value: d.coat },
        d.trouser && { label: 'Trouser', value: d.trouser },
        d.west && { label: 'Vest', value: d.west },
        d.national && { label: 'National', value: d.national },
      ].filter(Boolean);

      if (garments.length > 0) {
        garments.forEach((g, gi) => {
          // The database stores "ID — Description". Split and take only the ID.
          const codeOnly = g.value.split(/ — | - /)[0].trim();
          printRow(`${g.label}: ${codeOnly}`, gi === 0 ? formatLKR(d.rentOrSalePrice) : '');
        });
      } else {
        const itemName = d.name || d.itemName || `Item #${idx + 1}`;
        printRow(itemName, formatLKR(d.rentOrSalePrice));
      }
    });
  } else {
    printer.text('No items listed');
  }

  printer.text('-'.repeat(lineLength));
  
  printRow('Sub Total:', formatLKR(order.subTotal));
  printRow('Dry Cleaning:', isDryClean ? 'Yes' : 'No');
  printRow('Advance Paid:', formatLKR(order.paymentReceived));

  printer.text('='.repeat(lineLength));
  printer.size(1, 1);
  // size(1,1) doubles width, so line length is halved
  printRow('BALANCE:', formatLKR(order.remainingPayment), Math.floor(lineLength / 2));
  printer.size(0, 0);
  printer.text('='.repeat(lineLength));

  printRow('Payment Method:', order.paymentMethod || 'Cash');

  if (order.remark) {
    printer.text('-'.repeat(lineLength));
    printer.text(`Note: ${order.remark}`);
  }

  printer.text('-'.repeat(lineLength));
  printer.align('ct');
  printer.text('THANK YOU FOR CHOOSING US!');
  printer.text('Please bring this receipt when');
  printer.text('returning rented items.');
  printer.feed(2);
  printer.text('Software Powered by Inivac | 0742266018');
  
  printer.feed(4);
  printer.cut();
  printer.close();

  return device.buffer.toString('base64');
}
