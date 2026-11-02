// @ts-nocheck
// Demo data and the original role permission matrix.
export const INITIAL_STATE = {
    currentUser: null,
    nonAdminUsersPruned: true,
    // Role Permission Matrix for Access Control Management
    permissions: {
        'Admin': ['create_pr', 'approve_pr', 'record_delivery', 'manage_delivery_issues', 'approve_amendment', 'manage_users', 'manage_suppliers', 'rate_supplier', 'manage_permissions', 'view_all_po', 'manage_bidding'],
        'Procurement Head': ['create_pr','approve_pr','record_delivery','manage_delivery_issues','approve_amendment','manage_suppliers','rate_supplier','view_all_po','manage_bidding'],
        'Procurement Officer': ['create_pr','record_delivery','manage_suppliers','rate_supplier','view_all_po'],
        'Department Head': ['create_pr'],
        'Employee': ['create_pr'],
        'Finance Officer': ['process_payment','confirm_payment','view_all_po'],
        'Finance Head': ['process_payment','confirm_payment','view_all_po'],
        'Supplier': ['view_assigned_po','view_supplier_portal','submit_bids']
    },
    users: [
        { id: 'usr-1', username: 'admin', name: 'Admin', role: 'Admin', department: 'Executive', status: 'Active', email: 'admin@enterprise.com', password: 'password123', supplierId: null }
    ],
    stockNeeds: [
        {
            id: 'SN-2001',
            title: 'High-Performance Cloud Servers',
            targetQty: 10,
            budgetCap: 50000,
            techSpecs: '2U Rack Server, Dual Xeon Silver, 128GB RAM, 4x2TB NVMe SSDs in RAID 10',
            status: 'Published',
            createdBy: 'Admin',
            createdAt: '2026-10-24 10:00'
        }
    ],
    bids: [
        {
            id: 'BID-3001',
            needId: 'SN-2001',
            supplierId: 'sup-101',
            supplierName: 'Global Tech Supplies Inc.',
            unitPrice: 4800,
            totalCost: 48000,
            leadTimeDays: 14,
            notes: 'Includes 3 years 24/7 technical support and next-business-day hardware replacement warranty.',
            submittedAt: '2026-10-24 11:30',
            status: 'Submitted'
        }
    ],
    proposalMeetings: [
        {
            id: 'MTG-4001',
            needId: 'SN-2001',
            bidId: 'BID-3001',
            supplierId: 'sup-101',
            supplierName: 'Global Tech Supplies Inc.',
            date: '2026-10-28',
            time: '14:00',
            venue: 'HQ Executive Conference Room B & Online Stream',
            status: 'Pending Response',
            notes: 'Technical specification presentation and price negotiation round.'
        }
    ],
    requisitions: [
        {
            id: 'PR-1001',
            department: 'IT Systems',
            itemTitle: 'Dell XPS 15 Workstations',
            specs: 'Intel Core i9, 32GB RAM, 1TB NVMe SSD, RTX 4060, 15.6" UHD Display',
            targetDate: '2026-11-15',
            unitPrice: 2200,
            quantity: 5,
            totalCost: 11000,
            status: 'In Process',
            requestedBy: 'John Doe',
            requestedByUsername: 'emp_john',
            createdAt: '2026-10-20 09:30',
            remarks: 'Urgent replacement for software development team.'
        },
        {
            id: 'PR-1002',
            department: 'Human Resources',
            itemTitle: 'Ergonomic Mesh Office Chairs',
            specs: 'High-back mesh, adjustable lumbar support, 3D armrests, heavy duty base',
            targetDate: '2026-11-20',
            unitPrice: 250,
            quantity: 12,
            totalCost: 3000,
            status: 'Pending',
            requestedBy: 'Sarah Jenkins',
            requestedByUsername: 'emp_john',
            createdAt: '2026-10-22 14:15',
            remarks: 'Annual office furniture upgrade.'
        }
    ],
    orders: [
        {
            id: 'PO-5001',
            prId: 'PR-1001',
            supplierId: 'sup-101',
            supplierName: 'Global Tech Supplies Inc.',
            department: 'IT Systems',
            itemTitle: 'Dell XPS 15 Workstations',
            specs: 'Intel Core i9, 32GB RAM, 1TB NVMe SSD, RTX 4060, 15.6" UHD Display',
            quantity: 5,
            totalCost: 11000,
            poDate: '2026-10-21',
            status: 'Issued',
            type: 'Purchase Order',
            createdByName: 'Marcus Brody'
        }
    ],
    deliveries: [
        {
            id: 'DEL-8001',
            poId: 'PO-5001',
            prId: 'PR-1001',
            supplierName: 'Global Tech Supplies Inc.',
            department: 'IT Systems',
            itemTitle: 'Dell XPS 15 Workstations',
            specs: 'Intel Core i9, 32GB RAM, 1TB NVMe SSD, RTX 4060, 15.6" UHD Display',
            orderedQty: 5,
            deliveredQty: 5,
            expectedDate: '2026-10-24',
            actualDate: '2026-10-24',
            deliveryStatus: 'Delivered',
            complianceStatus: 'Completed - Verified',
            remarks: 'All 5 units delivered in perfect box sealing and benchmark tested.',
            recordedBy: 'Marcus Brody',
            updatedAt: '2026-10-24 10:00'
        }
    ],
    amendments: [],
    payments: [
        {
            id: 'PAY-9001',
            poId: 'PO-5001',
            supplierName: 'Global Tech Supplies Inc.',
            department: 'IT Systems',
            totalAmount: 11000,
            deliveryVerified: true,
            paymentAmount: 11000,
            paymentMethod: 'Bank Transfer',
            paymentDate: '2026-10-24',
            status: 'Paid',
            refNumber: 'TRX-998823104',
            remarks: 'Processed via wire transfer. Invoice #GT-8842 attached.',
            processedBy: 'Admin'
        }
    ],
    suppliers: [
        { id: 'sup-101', name: 'Global Tech Supplies Inc.', contact: 'Alex Rivera', email: 'sales@globaltech.com', phone: '+1 (555) 019-2834', category: 'IT Hardware' },
        { id: 'sup-102', name: 'Apex Office Solutions', contact: 'Clara Bennett', email: 'orders@apexoffice.com', phone: '+1 (555) 018-9921', category: 'Furniture & Supplies' },
        { id: 'sup-103', name: 'Industrial Maintenance Co.', contact: 'Robert Vance', email: 'service@indmaint.com', phone: '+1 (555) 012-3344', category: 'Services & Maintenance' }
    ],
    ratings: [
        {
            id: 'rat-1',
            supplierId: 'sup-101',
            evaluatorName: 'Eleanor Vance',
            evaluatorRole: 'Procurement Head',
            rating: 5,
            qualityScore: 5,
            deliveryScore: 5,
            pricingScore: 4,
            feedback: 'Exceptional delivery turnaround time and immaculate hardware condition.',
            createdAt: '2026-10-24 11:15'
        }
    ],
    auditLogs: [
        { id: 'log-1', timestamp: '2026-10-24 10:00', user: 'Admin', role: 'Admin', action: 'System Initialization', details: 'Database loaded with enhanced supplier rating & access management.' }
    ]
};
