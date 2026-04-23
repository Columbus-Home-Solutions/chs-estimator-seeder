function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }
  
  function nowISO() {
    return new Date().toISOString();
  }
  
  module.exports = {
    tabs: [
      {
        name: 'Settings',
        headers: ['key', 'value', 'notes'],
        seedRows: [
          ['active_pricebook_version', 'v1', 'Current active version'],
          ['default_overhead_pct', 0.15, '15% default overhead'],
          ['default_profit_pct', 0.2, '20% default profit'],
          ['default_contingency_pct', 0.08, '8% contingency'],
          ['sales_tax_pct', 0.0875, 'Adjust for your actual taxable handling'],
          ['currency', 'USD', 'Display currency']
        ]
      },
      {
        name: 'Pricebook_Master',
        headers: [
          'item_code',
          'category',
          'subcategory',
          'description',
          'unit',
          'material_cost',
          'labor_hours_per_unit',
          'labor_rate_ref',
          'equipment_cost_per_unit',
          'waste_pct',
          'overhead_pct_default',
          'profit_pct_default',
          'taxable',
          'vendor_ref',
          'source_type',
          'source_url',
          'source_date',
          'confidence_score',
          'status',
          'effective_date',
          'expiration_date',
          'pricebook_version',
          'last_updated_by',
          'last_updated_at'
        ],
        seedRows: [
          [
            'PNT-WALL-STD',
            'Paint',
            'Interior',
            'Interior wall paint - standard prep',
            'sf',
            0.42,
            0.03,
            'LAB-PAINT',
            0,
            0.1,
            0.15,
            0.2,
            'Y',
            'VENDOR-GENERAL',
            'manual',
            '',
            todayISO(),
            90,
            'Approved',
            todayISO(),
            '',
            'v1',
            'system',
            nowISO()
          ],
          [
            'FLR-LVP-STD',
            'Flooring',
            'LVP',
            'Install LVP flooring - standard underlayment',
            'sf',
            2.35,
            0.05,
            'LAB-FLOOR',
            0.12,
            0.07,
            0.15,
            0.2,
            'Y',
            'VENDOR-GENERAL',
            'manual',
            '',
            todayISO(),
            85,
            'Approved',
            todayISO(),
            '',
            'v1',
            'system',
            nowISO()
          ]
        ]
      },
      {
        name: 'Labor_Rates',
        headers: ['labor_rate_ref', 'role', 'hourly_rate', 'effective_date', 'status'],
        seedRows: [
          ['LAB-PAINT', 'Painter', 55, todayISO(), 'Active'],
          ['LAB-FLOOR', 'Flooring Installer', 65, todayISO(), 'Active'],
          ['LAB-CARP', 'Carpenter', 70, todayISO(), 'Active'],
          ['LAB-GEN', 'General Labor', 45, todayISO(), 'Active']
        ]
      },
      {
        name: 'Assemblies',
        headers: ['assembly_code', 'assembly_name', 'line_no', 'item_code', 'qty_formula', 'default_qty', 'optional_flag', 'notes'],
        seedRows: [
          ['BATH-STD-5X8', 'Bathroom Standard 5x8', 1, 'PNT-WALL-STD', 'room_wall_sf*1.1', 1, 'N', 'Starter sample row'],
          ['LVP-ROOM-STD', 'Standard LVP Room', 1, 'FLR-LVP-STD', 'room_floor_sf*1.07', 1, 'N', 'Starter sample row']
        ]
      },
      {
        name: 'Estimate_Header',
        headers: [
          'estimate_id',
          'revision_no',
          'customer_name',
          'property_address',
          'zip_code',
          'job_type',
          'scope_summary',
          'created_by',
          'created_at',
          'status',
          'overhead_pct',
          'profit_pct',
          'tax_pct',
          'contingency_pct',
          'assumptions_text',
          'jobber_client_id',
          'jobber_property_id',
          'jobber_quote_id',
          'jobber_sync_status',
          'jobber_synced_at'
        ],
        seedRows: []
      },
      {
        name: 'Estimate_Lines',
        headers: [
          'estimate_id',
          'revision_no',
          'line_no',
          'item_code',
          'description',
          'quantity',
          'unit',
          'material_unit_cost',
          'labor_hours_unit',
          'labor_rate',
          'equipment_unit_cost',
          'waste_pct',
          'line_subtotal',
          'taxable',
          'line_total',
          'ai_suggested',
          'approved_by'
        ],
        seedRows: []
      },
      {
        name: 'Estimate_Revisions',
        headers: ['estimate_id', 'revision_no', 'change_reason', 'changed_by', 'changed_at', 'diff_summary'],
        seedRows: []
      },
      {
        name: 'Review_Queue',
        headers: [
          'queue_id',
          'item_code',
          'old_price',
          'new_price',
          'variance_pct',
          'source_type',
          'source_url',
          'source_date',
          'approval_status',
          'reviewer',
          'reviewed_at',
          'notes'
        ],
        seedRows: []
      },
      {
        name: 'Source_Log',
        headers: ['import_id', 'source_name', 'source_url', 'imported_at', 'row_count', 'status', 'notes'],
        seedRows: []
      },
      {
        name: 'Vendors',
        headers: ['vendor_ref', 'vendor_name', 'contact_name', 'phone', 'email', 'city', 'state', 'active'],
        seedRows: []
      },
      {
        name: 'Regional_Adjustments',
        headers: ['zip_code', 'labor_multiplier', 'material_multiplier', 'effective_date', 'notes'],
        seedRows: [
          ['72116', 1.0, 1.0, todayISO(), 'North Little Rock baseline']
        ]
      },
      {
        name: 'Dashboard_KPIs',
        headers: ['kpi_name', 'kpi_value', 'period', 'updated_at'],
        seedRows: []
      },
      {
        name: 'Schema_Metadata',
        headers: ['schema_version', 'last_migrated_at', 'notes'],
        seedRows: [
          ['v1', nowISO(), 'Initial estimator schema']
        ]
      }
    ]
  };