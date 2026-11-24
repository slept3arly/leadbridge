# LeadBridge Project Directory Inventory

Filesystem inventory captured from the working tree. Hidden paths were included; secret contents were not read. Directory descriptions and file purposes are concise classifications based on paths and filenames, with purpose-unclear labels where names provide little signal.

## Directory tree

```text
leadbridge/
  .env — Local environment configuration; sensitive values intentionally not inspected.
  .env.example — Project/tooling configuration or metadata.
  .gitignore — Project/tooling configuration or metadata.
  .prettierrc — Project/tooling configuration or metadata.
  AGENTS.md — Project documentation covering agents.
  README.md — Project documentation covering readme.
  Start-LeadBridge.ps1 — Purpose unclear — requires inspection.
  backup-database.ps1 — Purpose unclear — requires inspection.
  eslint.config.mjs — Application/module code for eslint.config.
  next-env.d.ts — Application/module code for next env.d.
  next.config.ts — Application/module code for next.config.
  package.json — Project/tooling configuration or metadata.
  pnpm-lock.yaml — Project/tooling configuration or metadata.
  pnpm-workspace.yaml — Project/tooling configuration or metadata.
  postcss.config.mjs — Application/module code for postcss.config.
  prisma.config.ts — Application/module code for prisma.config.
  tsconfig.json — Project/tooling configuration or metadata.
  tsconfig.tsbuildinfo — Purpose unclear — requires inspection.
  .agents/ — Directory containing the listed child entries.
  .aws/ — Directory containing the listed child entries.
  .codex/ — Directory containing the listed child entries.
  docs/ — Directory containing the listed child entries.
    IMPLEMENTATION_AUDIT.md — Project documentation covering implementation audit.
    README.md — Project documentation covering readme.
    UI_DESIGN_SYSTEM.md — Project documentation covering ui design system.
    api.md — Project documentation covering api.
    architecture.md — Project documentation covering architecture.
    authentication.md — Project documentation covering authentication.
    backend.md — Project documentation covering backend.
    database.md — Project documentation covering database.
    development.md — Project documentation covering development.
    frontend.md — Project documentation covering frontend.
    integrations.md — Project documentation covering integrations.
    local-operations.md — Project documentation covering local operations.
    performance.md — Project documentation covering performance.
    rest-connector-testing.md — Project documentation covering rest connector testing.
    archive/ — Directory containing the listed child entries.
      01_PROJECT_OVERVIEW.md — Project documentation covering 01 project overview.
      02_ARCHITECTURE.md — Project documentation covering 02 architecture.
      03_DEVELOPMENT_GUIDELINES.md — Project documentation covering 03 development guidelines.
      04_ADMINISTRATION_AND_OPERATIONS.md — Project documentation covering 04 administration and operations.
      05_ARCHITECTURE_AUDIT.md — Project documentation covering 05 architecture audit.
      06_REST_CONNECTOR_IMPLEMENTATION_REPORT.md — Project documentation covering 06 rest connector implementation report.
    audits/ — Directory containing the listed child entries.
      MY_LEADS_UI_UX_ACCESSIBILITY_AND_DATA_AUDIT.md — Project documentation covering my leads ui ux accessibility and data audit.
      PHASE_1_IMPLEMENTATION_REPORT.md — Project documentation covering phase 1 implementation report.
      PHASE_2_IMPLEMENTATION_REPORT.md — Project documentation covering phase 2 implementation report.
    experiments/ — Directory containing the listed child entries.
      07_PERFORMANCE_ARCHITECTURE_ASSESSMENT.md — Project documentation covering 07 performance architecture assessment.
      08_FREE_TIER_CAPACITY_ASSESSMENT.md — Project documentation covering 08 free tier capacity assessment.
      09_PERFORMANCE_BASELINE_AUDIT.md — Project documentation covering 09 performance baseline audit.
      11_LOCAL_MAX_PERFORMANCE_AUDIT.md — Project documentation covering 11 local max performance audit.
      12_V1_PRODUCTION_READINESS_AUDIT.md — Project documentation covering 12 v1 production readiness audit.
      13_REPOSITORY_WIDE_IMPROVEMENT_AUDIT.md — Project documentation covering 13 repository wide improvement audit.
      14_PERFORMANCE_FRESHNESS_MAINTAINABILITY_AUDIT.md — Project documentation covering 14 performance freshness maintainability audit.
      15_LEAD_WORKFLOW_AND_MODAL_ARCHITECTURE_AUDIT.md — Project documentation covering 15 lead workflow and modal architecture audit.
      16_LEAD_WORKFLOW_CONTRACTS.md — Project documentation covering 16 lead workflow contracts.
      17_LEAD_UI_REFINEMENT_PLAN.md — Project documentation covering 17 lead ui refinement plan.
      18_EXPORT_SYSTEM_AUDIT.md — Project documentation covering 18 export system audit.
      19_EXPORT_SYSTEM_CONTRACTS.md — Project documentation covering 19 export system contracts.
      20_EXPORT_QUERY_ARCHITECTURE.md — Project documentation covering 20 export query architecture.
      21_EXPORT_DELIVERY_RELIABILITY.md — Project documentation covering 21 export delivery reliability.
      22_EXPORT_UI_IMPLEMENTATION.md — Project documentation covering 22 export ui implementation.
      23_EXPORT_SYSTEM_FINAL_REVIEW.md — Project documentation covering 23 export system final review.
      24_EXPORT_ADVANCED_LEAD_FILTERS.md — Project documentation covering 24 export advanced lead filters.
      25_LEAD_WORKFLOW_REDESIGN_AUDIT.md — Project documentation covering 25 lead workflow redesign audit.
      26_LEAD_WORKFLOW_BUSINESS_CONTRACTS.md — Project documentation covering 26 lead workflow business contracts.
      27_DISTRICT_COMPATIBILITY_ASSESSMENT.md — Project documentation covering 27 district compatibility assessment.
      28_WORKFLOW_ENUMS_AND_FORM_UX_AUDIT.md — Project documentation covering 28 workflow enums and form ux audit.
      29_PLACEHOLDERS_AND_DEFAULTS_REVIEW.md — Project documentation covering 29 placeholders and defaults review.
      30_PLACEHOLDERS_AND_DEFAULTS_IMPLEMENTATION.md — Project documentation covering 30 placeholders and defaults implementation.
      31_LEAD_STATUS_AND_CUSTOM_DROPDOWNS.md — Project documentation covering 31 lead status and custom dropdowns.
      32_EXPORT_SYSTEM_UX_AND_CAPABILITY_AUDIT.md — Project documentation covering 32 export system ux and capability audit.
      HOSTING_COMPARISON_2026.md — Project documentation covering hosting comparison 2026.
  mock-rest-api/ — Directory containing the listed child entries.
    .env.example — Project/tooling configuration or metadata.
    .gitignore — Project/tooling configuration or metadata.
    README.md — Project documentation covering readme.
    package-lock.json — Project/tooling configuration or metadata.
    package.json — Project/tooling configuration or metadata.
    server.js — Application/module code for server.
    data/ — Directory containing the listed child entries.
      leads.js — Application/module code for leads.
  prisma/ — Directory containing the listed child entries.
    schema.prisma — Purpose unclear — requires inspection.
    seed.ts — Application/module code for seed.
    migrations/ — Directory containing the listed child entries.
      migration_lock.toml — Project/tooling configuration or metadata.
      20260713173452_init/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260714120000_phase1_crm_data_model/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260714143000_phase2_connector_sync_history/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260715100000_phase3a_provider_management/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260717081405_add_connector_schedule_health/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260717164212_extend_status_priority_add_followups/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260717183000_add_lead_connector_source_reference_unique/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260718081824_add_lead_category/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260718090013_simplify_status_add_notes_followups/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260718091500_simplify_enums_consistency/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260718103934_add_completed_at_backfill/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260719122327_add_sales_privilege/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260825171917_phase2_performance_indexes/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260909000000_add_followup_lifecycle_events/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260913000000_add_activity_event_entry/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20260913120000_remove_lead_activity_and_audit_log/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20261010000000_add_connector_lock_generation/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20261109090000_add_lead_district/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20261109100000_followup_one_pending_per_lead/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20261110090000_add_workflow_enum_options/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
      20261111090000_add_old_lead_status/ — Directory containing the listed child entries.
        migration.sql — Database migration defining a versioned schema/data change.
  public/ — Directory containing the listed child entries.
    file.svg — Static visual asset.
    globe.svg — Static visual asset.
    next.svg — Static visual asset.
    vercel.svg — Static visual asset.
    window.svg — Static visual asset.
  scripts/ — Directory containing the listed child entries.
    phase2-smoke.ts — Application/module code for phase2 smoke.
    phase3a-smoke.ts — Application/module code for phase3a smoke.
    run-postgres-integration-tests.mjs — Application/module code for run postgres integration tests.
    seed-leads.ts — Application/module code for seed leads.
  src/ — Directory containing the listed child entries.
    proxy.ts — Application/module code for proxy.
    app/ — Directory containing the listed child entries.
      favicon.ico — Static visual asset.
      globals.css — Purpose unclear — requires inspection.
      layout.tsx — Application/module code for layout.
      page.tsx — Application/module code for page.
      (dashboard)/ — Directory containing the listed child entries.
        loading.tsx — Application/module code for loading.
        admin/ — Directory containing the listed child entries.
          layout.tsx — Application/module code for layout.
          loading.tsx — Application/module code for loading.
          page.tsx — Application/module code for page.
          connectors/ — Directory containing the listed child entries.
            error.tsx — Application/module code for error.
            loading.tsx — Application/module code for loading.
            page.tsx — Application/module code for page.
          exports/ — Directory containing the listed child entries.
            page.tsx — Application/module code for page.
          leads/ — Directory containing the listed child entries.
            error.tsx — Application/module code for error.
            loading.tsx — Application/module code for loading.
            page.tsx — Application/module code for page.
          providers/ — Directory containing the listed child entries.
            error.tsx — Application/module code for error.
            loading.tsx — Application/module code for loading.
            page.tsx — Application/module code for page.
          reports/ — Directory containing the listed child entries.
            loading.tsx — Application/module code for loading.
            page.tsx — Application/module code for page.
          settings/ — Directory containing the listed child entries.
            loading.tsx — Application/module code for loading.
            page.tsx — Application/module code for page.
          users/ — Directory containing the listed child entries.
            error.tsx — Application/module code for error.
            loading.tsx — Application/module code for loading.
            page.tsx — Application/module code for page.
        sales/ — Directory containing the listed child entries.
          layout.tsx — Application/module code for layout.
          loading.tsx — Application/module code for loading.
          page.tsx — Application/module code for page.
          exports/ — Directory containing the listed child entries.
            page.tsx — Application/module code for page.
          my-leads/ — Directory containing the listed child entries.
            loading.tsx — Application/module code for loading.
            page.tsx — Application/module code for page.
          profile/ — Directory containing the listed child entries.
            page.tsx — Application/module code for page.
            user-id-field.tsx — Application/module code for user id field.
          tasks/ — Directory containing the listed child entries.
            page.tsx — Application/module code for page.
      api/ — Directory containing the listed child entries.
        activities/ — Directory containing the listed child entries.
          [id]/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
        audit-logs/ — Directory containing the listed child entries.
        auth/ — Directory containing the listed child entries.
          [...all]/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
        connectors/ — Directory containing the listed child entries.
          route.ts — Application/module code for route.
          [id]/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
            settings/ — Directory containing the listed child entries.
              route.ts — Application/module code for route.
            sync/ — Directory containing the listed child entries.
              route.ts — Application/module code for route.
        dashboard/ — Directory containing the listed child entries.
          route.ts — Application/module code for route.
        export/ — Directory containing the listed child entries.
          route.ts — Application/module code for route.
        follow-ups/ — Directory containing the listed child entries.
          [id]/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
            cancel/ — Directory containing the listed child entries.
            complete/ — Directory containing the listed child entries.
              route.ts — Application/module code for route.
        health/ — Directory containing the listed child entries.
          live/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
          ready/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
        lead-sources/ — Directory containing the listed child entries.
          route.ts — Application/module code for route.
          [id]/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
        leads/ — Directory containing the listed child entries.
          route.ts — Application/module code for route.
          [id]/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
            activities/ — Directory containing the listed child entries.
              route.ts — Application/module code for route.
            assign/ — Directory containing the listed child entries.
              route.ts — Application/module code for route.
            details/ — Directory containing the listed child entries.
              route.ts — Application/module code for route.
            follow-ups/ — Directory containing the listed child entries.
              route.ts — Application/module code for route.
            notes/ — Directory containing the listed child entries.
              route.ts — Application/module code for route.
        mock/ — Directory containing the listed child entries.
          leads/ — Directory containing the listed child entries.
        notes/ — Directory containing the listed child entries.
          [id]/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
        parsers/ — Directory containing the listed child entries.
          route.ts — Application/module code for route.
          preview/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
        providers/ — Directory containing the listed child entries.
          route.ts — Application/module code for route.
          [id]/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
          connectors/ — Directory containing the listed child entries.
            test/ — Directory containing the listed child entries.
              route.ts — Application/module code for route.
          gmail/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
          parser-requests/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
          parsers/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
          routing-rules/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
            [id]/ — Directory containing the listed child entries.
              route.ts — Application/module code for route.
          sync-runs/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
          unmatched/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
        reports/ — Directory containing the listed child entries.
          route.ts — Application/module code for route.
        resync/ — Directory containing the listed child entries.
          route.ts — Application/module code for route.
        scheduler/ — Directory containing the listed child entries.
          trigger/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
        settings/ — Directory containing the listed child entries.
          route.ts — Application/module code for route.
        sync/ — Directory containing the listed child entries.
        users/ — Directory containing the listed child entries.
          route.ts — Application/module code for route.
          [id]/ — Directory containing the listed child entries.
            route.ts — Application/module code for route.
      login/ — Directory containing the listed child entries.
        page.tsx — Application/module code for page.
    components/ — Directory containing the listed child entries.
      login-form.tsx — Application/module code for login form.
      admin/ — Directory containing the listed child entries.
        admin-dashboard-client.tsx — Application/module code for admin dashboard client.
        admin-reports.tsx — Application/module code for admin reports.
        admin-settings.tsx — Application/module code for admin settings.
      connectors/ — Directory containing the listed child entries.
        connector-edit-modal.tsx — Application/module code for connector edit modal.
        connectors-page-content.tsx — Application/module code for connectors page content.
        sync-history-modal.tsx — Application/module code for sync history modal.
      export/ — Directory containing the listed child entries.
        export-workspace.tsx — Application/module code for export workspace.
      leads/ — Directory containing the listed child entries.
        admin-leads-page-content.tsx — Application/module code for admin leads page content.
        lead-edit-modal.tsx — Application/module code for lead edit modal.
        lead-source-manager-modal.tsx — Application/module code for lead source manager modal.
        lead-status-priority-cell.tsx — Application/module code for lead status priority cell.
        record-progress-modal.tsx — Application/module code for record progress modal.
      providers/ — Directory containing the listed child entries.
        provider-edit-modal.tsx — Application/module code for provider edit modal.
        providers-page-content.tsx — Application/module code for providers page content.
        routing-rules-manager.tsx — Application/module code for routing rules manager.
      sales/ — Directory containing the listed child entries.
        activity-fields.tsx — Application/module code for activity fields.
        attention-card.tsx — Application/module code for attention card.
        attention-center.tsx — Application/module code for attention center.
        daily-history.tsx — Application/module code for daily history.
        follow-up-dropdown.tsx — Application/module code for follow up dropdown.
        go-to-top-button.tsx — Application/module code for go to top button.
        lead-action-bar.tsx — Application/module code for lead action bar.
        lead-action-panel.tsx — Application/module code for lead action panel.
        lead-detail-dialog.tsx — Application/module code for lead detail dialog.
        lead-details-modal.tsx — Application/module code for lead details modal.
        lead-details-popup.tsx — Application/module code for lead details popup.
        lead-header.tsx — Application/module code for lead header.
        lead-info-section.tsx — Application/module code for lead info section.
        sales-dashboard-client.tsx — Application/module code for sales dashboard client.
        sales-my-leads-page-content.tsx — Application/module code for sales my leads page content.
        sales-table-controls.tsx — Application/module code for sales table controls.
        tasks-table-client.tsx — Application/module code for tasks table client.
      shared/ — Directory containing the listed child entries.
        active-filters.tsx — Application/module code for active filters.
        app-shell.tsx — Application/module code for app shell.
        blueprint-background.tsx — Application/module code for blueprint background.
        data-table.tsx — Application/module code for data table.
        date-range-picker.tsx — Application/module code for date range picker.
        date-time-display.tsx — Application/module code for date time display.
        export-button.tsx — Application/module code for export button.
        kpi-card.tsx — Application/module code for kpi card.
        lead-actions.tsx — Application/module code for lead actions.
        navbar.tsx — Application/module code for navbar.
        resync-button.tsx — Application/module code for resync button.
        search-toolbar.tsx — Application/module code for search toolbar.
        sign-out-button.tsx — Application/module code for sign out button.
        table-controls.tsx — Application/module code for table controls.
        navigation/ — Directory containing the listed child entries.
          BottomNavigation.tsx — Application/module code for BottomNavigation.
          BottomNavigationItem.tsx — Application/module code for BottomNavigationItem.
          BottomNavigationMenu.tsx — Application/module code for BottomNavigationMenu.
          NavigationProvider.tsx — Application/module code for NavigationProvider.
          NavigationSection.tsx — Application/module code for NavigationSection.
      ui/ — Directory containing the listed child entries.
        accordion-section.tsx — Application/module code for accordion section.
        animated-reveal.tsx — Application/module code for animated reveal.
        badge.tsx — Application/module code for badge.
        button.tsx — Application/module code for button.
        card.tsx — Application/module code for card.
        confirm-dialog.tsx — Application/module code for confirm dialog.
        date-time-cell.tsx — Application/module code for date time cell.
        empty-state.tsx — Application/module code for empty state.
        error-state.tsx — Application/module code for error state.
        expandable-section.tsx — Application/module code for expandable section.
        filter-chip.tsx — Application/module code for filter chip.
        filter-popover.tsx — Application/module code for filter popover.
        form-field.tsx — Application/module code for form field.
        icon-action-button.tsx — Application/module code for icon action button.
        input.tsx — Application/module code for input.
        label.tsx — Application/module code for label.
        loading.tsx — Application/module code for loading.
        pagination.tsx — Application/module code for pagination.
        segmented-control.tsx — Application/module code for segmented control.
        select.tsx — Application/module code for select.
        textarea.tsx — Application/module code for textarea.
      users/ — Directory containing the listed child entries.
        user-edit-modal.tsx — Application/module code for user edit modal.
        user-table-controls.tsx — Application/module code for user table controls.
        users-page-content.tsx — Application/module code for users page content.
    connectors/ — Directory containing the listed child entries.
      environment.ts — Application/module code for environment.
      registry.ts — Application/module code for registry.
      types.ts — Application/module code for types.
      gmail/ — Directory containing the listed child entries.
        gmail-batch.ts — Application/module code for gmail batch.
        gmail-client.ts — Application/module code for gmail client.
        gmail-connector.ts — Application/module code for gmail connector.
        gmail-errors.ts — Application/module code for gmail errors.
        gmail-parser.ts — Application/module code for gmail parser.
        gmail-types.ts — Application/module code for gmail types.
      rest/ — Directory containing the listed child entries.
        rest-client.ts — Application/module code for rest client.
        rest-connector.ts — Application/module code for rest connector.
        rest-errors.ts — Application/module code for rest errors.
        rest-security.ts — Application/module code for rest security.
        rest-types.ts — Application/module code for rest types.
    generated/ — Directory containing the listed child entries.
      prisma/ — Directory containing the listed child entries.
        browser.ts — Application/module code for browser.
        client.ts — Application/module code for client.
        commonInputTypes.ts — Application/module code for commonInputTypes.
        enums.ts — Application/module code for enums.
        models.ts — Application/module code for models.
        internal/ — Directory containing the listed child entries.
          class.ts — Application/module code for class.
          prismaNamespace.ts — Application/module code for prismaNamespace.
          prismaNamespaceBrowser.ts — Application/module code for prismaNamespaceBrowser.
        models/ — Directory containing the listed child entries.
          Account.ts — Application/module code for Account.
          ActivityEntry.ts — Application/module code for ActivityEntry.
          ActivityEvent.ts — Application/module code for ActivityEvent.
          Attachment.ts — Application/module code for Attachment.
          Connector.ts — Application/module code for Connector.
          ConnectorSyncRun.ts — Application/module code for ConnectorSyncRun.
          FieldMapping.ts — Application/module code for FieldMapping.
          FollowUp.ts — Application/module code for FollowUp.
          Lead.ts — Application/module code for Lead.
          LeadSource.ts — Application/module code for LeadSource.
          Note.ts — Application/module code for Note.
          Parser.ts — Application/module code for Parser.
          ParserRequest.ts — Application/module code for ParserRequest.
          RoutingRule.ts — Application/module code for RoutingRule.
          Session.ts — Application/module code for Session.
          Setting.ts — Application/module code for Setting.
          UnmatchedEmail.ts — Application/module code for UnmatchedEmail.
          User.ts — Application/module code for User.
          Verification.ts — Application/module code for Verification.
    hooks/ — Directory containing the listed child entries.
      index.ts — Application/module code for index.
      use-accessible-dialog.ts — Application/module code for use accessible dialog.
      use-crm-sync.ts — Application/module code for use crm sync.
      use-hydrated.ts — Application/module code for use hydrated.
      use-lead-details.ts — Application/module code for use lead details.
      use-table-query.ts — Application/module code for use table query.
    jobs/ — Directory containing the listed child entries.
      index.ts — Application/module code for index.
    lib/ — Directory containing the listed child entries.
      activity-options.ts — Application/module code for activity options.
      api.ts — Application/module code for api.
      auth-client.ts — Application/module code for auth client.
      auth.ts — Application/module code for auth.
      cache-tags.ts — Application/module code for cache tags.
      create-lead-enter-navigation.ts — Application/module code for create lead enter navigation.
      crm-sync.ts — Application/module code for crm sync.
      csv.ts — Application/module code for csv.
      database-readiness.ts — Application/module code for database readiness.
      follow-up-date.ts — Application/module code for follow up date.
      follow-up-form-date.ts — Application/module code for follow up form date.
      get-error-message.ts — Application/module code for get error message.
      lead-constants.ts — Application/module code for lead constants.
      lead-create-accordion.ts — Application/module code for lead create accordion.
      lead-workspace.ts — Application/module code for lead workspace.
      logger.ts — Application/module code for logger.
      navigation.tsx — Application/module code for navigation.
      permissions.ts — Application/module code for permissions.
      prisma.ts — Application/module code for prisma.
      query-builder.ts — Application/module code for query builder.
      record-progress-follow-ups.ts — Application/module code for record progress follow ups.
      scheduler-auth.ts — Application/module code for scheduler auth.
      scheduler-schedule.ts — Application/module code for scheduler schedule.
      service-errors.ts — Application/module code for service errors.
      session.ts — Application/module code for session.
      utils.ts — Application/module code for utils.
      validation.ts — Application/module code for validation.
      export/ — Directory containing the listed child entries.
        dates.ts — Application/module code for dates.
        fields.ts — Application/module code for fields.
        filters.ts — Application/module code for filters.
        index.ts — Application/module code for index.
        legacy-compatibility.ts — Application/module code for legacy compatibility.
        legacy-contract.ts — Application/module code for legacy contract.
        output.ts — Application/module code for output.
        policy.ts — Application/module code for policy.
        registry.ts — Application/module code for registry.
        ui.ts — Application/module code for ui.
    parsers/ — Directory containing the listed child entries.
      base-parser.ts — Application/module code for base parser.
      example-parser.ts — Application/module code for example parser.
      parser-manifest.ts — Application/module code for parser manifest.
      registry.ts — Application/module code for registry.
    runtime/ — Directory containing the listed child entries.
      connector-executor.ts — Application/module code for connector executor.
      connector-runtime.ts — Application/module code for connector runtime.
      execution-context.ts — Application/module code for execution context.
      lead-normalizer.ts — Application/module code for lead normalizer.
      parser-runtime.ts — Application/module code for parser runtime.
      retry-policy.ts — Application/module code for retry policy.
      routing-engine.ts — Application/module code for routing engine.
      runtime-errors.ts — Application/module code for runtime errors.
      runtime-result.ts — Application/module code for runtime result.
      runtime-types.ts — Application/module code for runtime types.
      sync-history.ts — Application/module code for sync history.
    services/ — Directory containing the listed child entries.
      activity-event.service.ts — Application/module code for activity event.service.
      assignment.service.ts — Application/module code for assignment.service.
      attention.service.ts — Application/module code for attention.service.
      connector-health.service.ts — Application/module code for connector health.service.
      connector.service.ts — Application/module code for connector.service.
      dashboard.service.ts — Application/module code for dashboard.service.
      duplicate.service.ts — Application/module code for duplicate.service.
      execution-fence.ts — Application/module code for execution fence.
      execution-lock.service.ts — Application/module code for execution lock.service.
      export.service.ts — Application/module code for export.service.
      follow-up-policy.ts — Application/module code for follow up policy.
      follow-up.service.ts — Application/module code for follow up.service.
      lead-workflow.service.ts — Application/module code for lead workflow.service.
      lead.service.ts — Application/module code for lead.service.
      note.service.ts — Application/module code for note.service.
      parser-request.service.ts — Application/module code for parser request.service.
      parser.service.ts — Application/module code for parser.service.
      provider.service.ts — Application/module code for provider.service.
      report.service.ts — Application/module code for report.service.
      scheduler.service.ts — Application/module code for scheduler.service.
      settings.service.ts — Application/module code for settings.service.
      unmatched-email.service.ts — Application/module code for unmatched email.service.
      user.service.ts — Application/module code for user.service.
      export/ — Directory containing the listed child entries.
        authorization.ts — Application/module code for authorization.
        csv-serialization.ts — Application/module code for csv serialization.
        csv-stream.ts — Application/module code for csv stream.
        deadline.ts — Application/module code for deadline.
        keyset.ts — Application/module code for keyset.
        limits.ts — Application/module code for limits.
        operation-log.ts — Application/module code for operation log.
        projections.ts — Application/module code for projections.
        query-builders.ts — Application/module code for query builders.
        query.service.ts — Application/module code for query.service.
        scope.ts — Application/module code for scope.
    types/ — Directory containing the listed child entries.
      lead.ts — Application/module code for lead.
    utils/ — Directory containing the listed child entries.
      index.ts — Application/module code for index.
  tests/ — Directory containing the listed child entries.
    activity-patch-validation.test.ts — Test coverage for activity patch validation.
    cache-tags.test.ts — Test coverage for cache tags.
    crm-sync.test.ts — Test coverage for crm sync.
    dashboard-activity.postgres.test.ts — Test coverage for dashboard activity.postgres.
    database-readiness.test.ts — Test coverage for database readiness.
    execution-fencing.postgres.test.ts — Test coverage for execution fencing.postgres.
    export-contracts.test.ts — Test coverage for export contracts.
    export-delivery.test.ts — Test coverage for export delivery.
    export-query.test.ts — Test coverage for export query.
    export-ui.test.ts — Test coverage for export ui.
    filter-popover-interaction.test.tsx — Test coverage for filter popover interaction.
    follow-up-completion.postgres.test.ts — Test coverage for follow up completion.postgres.
    follow-up-lifecycle-contract.test.ts — Test coverage for follow up lifecycle contract.
    follow-up-lifecycle.postgres.test.ts — Test coverage for follow up lifecycle.postgres.
    lead-creation-validation.test.ts — Test coverage for lead creation validation.
    lead-creation.postgres.test.ts — Test coverage for lead creation.postgres.
    lead-district-compatibility.test.ts — Test coverage for lead district compatibility.
    lead-workflow-business-contract.test.ts — Test coverage for lead workflow business contract.
    lead-workflow-entrypoints.test.ts — Test coverage for lead workflow entrypoints.
    lead-workflow-form.test.ts — Test coverage for lead workflow form.
    lead-workflow.postgres.test.ts — Test coverage for lead workflow.postgres.
    lead-workspace.test.ts — Test coverage for lead workspace.
    note-scheduling-validation.test.ts — Test coverage for note scheduling validation.
    note-scheduling.postgres.test.ts — Test coverage for note scheduling.postgres.
    phase1-hardening.test.ts — Test coverage for phase1 hardening.
    phase1-my-leads.test.tsx — Test coverage for phase1 my leads.
    record-progress-accordion.test.ts — Test coverage for record progress accordion.
    record-progress-follow-ups.test.ts — Test coverage for record progress follow ups.
```

## Excluded generated, cached, and dependency directories

- `.git/` — repository object database and metadata; excluded from source inventory.
- `node_modules/` and `mock-rest-api/node_modules/` — installed dependencies; ignored/generated and excluded from detailed file listing.
- `.next/` — Next.js build/cache output; ignored/generated.
- `.pnpm-store/` — package manager content-addressed cache; ignored/generated.
- `graphify-out/` — generated graph analysis output; ignored/generated.
- `src/generated/prisma/` — generated Prisma client, included above because it is inside the source tree and tracked/present.

## A. Directory overview

- `src/` contains the Next.js application, UI, API handlers, services, integrations, runtime, parsers, and shared libraries.
- `prisma/` contains the schema, seed, migration lock, and ordered SQL migrations.
- `docs/` contains canonical guides, archived docs, experiments, and audits.
- `tests/` contains unit, UI, contract, and PostgreSQL integration tests.
- `scripts/` contains smoke, seed, and integration-test tooling.
- `public/` contains static assets.
- `mock-rest-api/` contains a standalone mock REST service and sample data.
- Root files provide project metadata, framework/tool configuration, launch/backup scripts, and environment templates.

## B. File classification

- Application source code: `src/app/`, `src/lib/`, `src/hooks/`, `src/runtime/`, `src/parsers/`, `src/types/`, `src/utils/`.
- Components and UI: `src/components/`, plus `src/app/globals.css`.
- Backend and API: `src/app/api/`, `src/services/`, `src/jobs/`, `src/proxy.ts`.
- Database and Prisma: `prisma/`, `prisma.config.ts`, and `src/generated/prisma/`.
- Authentication and authorization: `src/lib/auth*`, `src/lib/session.ts`, `src/lib/permissions.ts`, auth API route.
- Integrations: `src/connectors/`, `src/runtime/`, `src/parsers/`, `mock-rest-api/`.
- Configuration: root dotfiles, package manifests/locks, `next.config.ts`, `tsconfig.json`, and lint/style configs.
- Documentation: `docs/`, `README.md`, and `AGENTS.md`.
- Tests: `tests/` and scripts with smoke/integration purpose.
- Assets and static resources: `public/`, favicon.
- Scripts and tooling: `scripts/`, PowerShell scripts.
- Generated/build/dependency files: `src/generated/prisma/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`; ignored output/cache directories listed above.
- Other or unclear: `.env` (sensitive local configuration; purpose clear, contents not inspected).

## C. Potential cleanup candidates

- `src/generated/prisma/`: generated client code may be build-generated; verify generator output and tracking policy before considering cleanup.
- `next-env.d.ts` and `tsconfig.tsbuildinfo`: framework/compiler generated artifacts; inspect tracking and regeneration expectations.
- `.pnpm-store/`, `.next/`, `node_modules/`, `graphify-out/`: ignored generated/cache/dependency directories; confirm they are intentionally local and not required for source distribution.
- `src/app/api/audit-logs/`, `src/app/api/mock/`, `src/app/api/sync/`, `src/app/api/follow-ups/[id]/cancel/`: directories appeared empty in the filesystem walk; verify whether placeholders or untracked/omitted route files are intended.
- `src/components/sales/lead-detail-dialog.tsx`, `lead-details-modal.tsx`, and `lead-details-popup.tsx`: similar names indicate potentially overlapping UI roles; inspect imports and usage before classifying.
- `src/lib/export/legacy-compatibility.ts` and `legacy-contract.ts`: explicitly legacy-named compatibility modules; assess callers and migration status.
- `docs/archive/` and `docs/experiments/`: historical/experimental documents may contain superseded guidance; retain until cross-references and canonical status are reviewed.
- `mock-rest-api/package-lock.json` alongside root pnpm manifests: separate npm package may be deliberate; verify workspace/package-manager policy.

## D. Cleanup starting points

Start with `docs/` for a low-risk first review: it is separated from runtime behavior, and canonical, archived, experimental, and audit material is already segmented. Then review `src/components/sales/` for possible overlapping UI files, validating imports before any changes.

## Counts

- Detailed tree: 134 directories and 423 files.
- Excluded from detailed file mapping: `.git/`, dependency installs, framework/cache output, package store, and graph output listed above. Ignored files `.env`, `next-env.d.ts`, and `tsconfig.tsbuildinfo` remain represented in the tree.

## Follow-up note — 2026-11-23

This report remains a snapshot of its captured working tree. Subsequent approved cleanup work made these listed details outdated:

- Removed `scripts/seed-leads.ts` and `scripts/phase2-smoke.ts`; the current `scripts/` directory retains `phase3a-smoke.ts` and `run-postgres-integration-tests.mjs`.
- Removed `src/services/assignment.service.ts`, `src/hooks/index.ts`, `src/jobs/index.ts`, and `src/utils/index.ts`. The remaining hook modules and other source files were not removed by that stage.
- Removed the `seed:leads` package command. Prisma's separately configured seed remains `tsx prisma/seed.ts` in `prisma.config.ts`.
- The captured `docs/audits/` tree predates the later cleanup reports and its README index. `docs/experiments/README.md` was also added later; see the current [documentation index](../README.md), [audit index](README.md), and [experiment index](../experiments/README.md).

These notes supplement the original inventory; they do not revise its historical observations or imply that other recommendations in it were implemented.

## Follow-up note — 2026-11-24

The approved documentation reduction removed the listed obsolete experiment reports and all six files under `docs/archive/`. The current experiment index lists only the retained [workflow enums audit](../experiments/28_WORKFLOW_ENUMS_AND_FORM_UX_AUDIT.md) and [export capability audit](../experiments/32_EXPORT_SYSTEM_UX_AND_CAPABILITY_AUDIT.md). The original tree above remains a historical snapshot, not a current directory inventory.
