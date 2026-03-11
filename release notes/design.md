# Security Matrix Viewer

**Feature Info**
* **VPD Feature:** LINK
* **Jira EPIC:** LINK
* **Feature Overview:** LINK

## Release Note
Users can view Security Matrices in Vault without having to rely on the Configuration Report.

## Background & Stakeholders
As Vault security models grow in complexity, the number of Permission Sets associated with individual Security Profiles increases. Currently, assessing the overlap or gap in permissions requires a manual audit of individual components. This feature aims to assist in the analysis of these security structures.

### Terminology & Personas
*   **Effective Permission:** The resulting access level when multiple Permission Sets are aggregated.
*   **Matrix Component:** The underlying MDL-defined container for security data visualization.
*   **Personas:** Security Admins, System Auditors.

## Data Model & Dependencies
The feature utilizes a new system-owned object `security_matrix_cache__sys` to store temporary calculations of the matrix. There will be a new standard layout added for this object.

### Data Model - Vault Object Configuration

| Object Name | Description | App-Specific | Raw Object? | Audit? | Clone? | Daily Export? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `security_matrix_cache__sys` | The object storing the matrix elements | Platform | Yes | N | N | N |

## Detailed Design
*The Feature Overview is the guiding vision. This detailed design describes what stories are required to deliver this vision.*

### Matrix Generation
*   The system shall generate a grid-based view of all active Security Profiles on the X-axis and Permission Sets on the Y-axis.
*   The `GET /api/{version}/security/matrix/calculate` endpoint will be used to perform the calculation of the matrix. The response will contain the calculated matrix for all Admin, Application, Object, Tabs, Pages, Mobile, and API permissions for Security Profiles and their contained permission sets.
*   The `POST /api/v24.3/internal/security/matrix/cache` endpoint will be used to cache the results in the `security_matrix_cache__sys` object records.
*   The system triggers an asynchronous job to scan all `security_profile__v` components and their related `permission_set__v` links.
*   Scoping logic filters out inactive profiles to prevent the generation of orphaned data nodes in the rendering pipeline.
*   The engine utilizes a recursive dependency check to identify nested permission sets within the vault's inheritance hierarchy.
*   For every profile, the system performs a bitwise OR operation across all associated permission sets to determine the final access level.
*   Conflicts in permission overlaps (e.g., Read vs. Read/Edit) are resolved using the most permissive access logic at the runtime evaluation level.
*   Calculated values are mapped to a temporary transient state to ensure UI responsiveness during high-concurrency access periods.

### UI / UX
*   The UI utilizes a dual-axis grid where Security Profiles populate the X-axis and functional permission sets populate the Y-axis.
*   A "Difference Mode" toggle shall allow admins to select two Security Profiles and highlight only the cells where their effective permissions diverge.
*   The grid shall support "Sticky Headers" for both the X and Y axes to ensure context is maintained while scrolling through large datasets.
*   Admins can filter the Y-axis by specific functional areas.
*   **Color Coding:**
    *   **R** (Read) = Green
    *   **RCE** (Read/Create/Edit) = Yellow
    *   **RE** (Read/Edit) = Blue
    *   **RCED** = (Read/Create/Edit/Delete) = Purple
    *   **V** (View) = Green
    *   **EX** (Execute) = Purple
    *   **X** (having a permission) = Purple
*   Cell-level tooltips shall display the source Permission Set(s) contributing to the effective permission value for rapid troubleshooting of inherited access.
*   For Object-level permissions, the UI shall allow expanding a row to see granular Field Level Security (FLS) breakdowns within the same grid context.
*   Lazy loading is implemented via the `IntersectionObserver` API to manage the DOM footprint of the matrix when exceeding 1,000 cells.
*   The UI shall have Drag-and-drop reordering of Profiles on the X-axis.
*   Users can toggle visibility of columns to focus on specific security clusters without modifying the underlying MDL configuration.
*   Users can manually trigger a refresh of the matrix if they suspect the cache is out of sync with the underlying MDL components.

### State Management
*   The viewer tracks the current filtered state using the `security_matrix_cache__sys` object to maintain user context across page navigations.
*   Cache invalidation is triggered automatically upon the detection of `ComponentMetadataChange` events in the security domain.
*   To optimize performance, the system shall implement a "Stale-While-Revalidate" caching strategy, serving existing cache while the background job refreshes the `security_matrix_cache__sys` records.
*   User-specific grid layouts (hidden columns, custom sort orders) shall be persisted.
*   A "Last Calculated" timestamp shall be visible in the UI header, indicating the data currency of the current matrix view.
*   Use the `security_profile_mapping` endpoint to retrieve JSON arrays of assigned permissions for the current session.

### Logic Aggregation
*   The system calculates effective permissions using the `calculate_effective_matrix` internal logic to determine the value which should be placed in the cell.
*   The `GET /api/v24.3/objects/records/access_check` will be provided that accepts a `user_id` and `record_id` (non-document objects only) to return a boolean value representing whether the user can access said record.

### Output Generation
*   Within the configuration menu, an option to 'Export to Spreadsheet' allows for the generation of a `.xlsx` file containing the current matrix view for offline reporting.
*   This generates a `.xlsx` file containing the full grid data and current filter criteria for offline review.
*   The `.xlsx` export shall preserve the UI color-coding using Excel Conditional Formatting to maintain visual consistency for compliance auditors.
*   Export files shall include a "Metadata Summary" sheet listing the Vault ID, Timestamp, and the specific Security Profiles included in the export.
*   Large exports (exceeding 5,000 cells) shall be processed as a background notification task, delivering a download link to the user's email once the file is ready.
*   The export utility utilizes the `SecurityMatrixService` SDK to generate an output that can be converted into CSV or XLSX.

### Entry Point
*   The viewer is accessible via **Business Admin > Security > Security Matrix**.
*   A "View Security Matrix" button shall be added to the individual Security Profile detail page, pre-filtering the matrix to show only that specific profile.

### Configuration
*   It should be possible to configure the color of the matrix values (R, RE, etc) of the Effective Permission types.
*   It should be possible to save which Admin, Application, Object, etc permissions and in what order are they displayed.
*   Admins shall be able to define "Permission Groups" (e.g., "Quality Control Group") to aggregate multiple related Permission Sets into a single expandable row on the Y-axis.
*   Configuration allows for the exclusion of "Standard" (System-Managed) Permission Sets from the view to focus solely on custom-configured security components.

## Performance, Security, and Audit

### Performance Considerations and Limits
The calculation engine is highly optimized for comparative analysis. To ensure stability and prevent browser timeouts, the system is designed to handle the simultaneous comparison of primary and secondary Security Profiles. Users attempting to visualize the entire domain at once may experience staggered loading.
*   **Performance Limit:** System should support up to 50 Security Profiles in a single view.

### Security Considerations
This feature respects standard `Admin: Security: Security Profiles` permissions.

### Audit Trail Requirements
*   The system must create an audit log when a Security Matrix is generated.
*   The system must have different audit logs when a new Security Matrix is generated or an existing one is updated.

## MDL Requirements
These requirements pertain to the MDL, and also to migrating configuration through VPK files, and cloning vaults.

*   A new MDL Component type `Securitymatrix` needs to be created to store the configuration elements of the generated Security matrices.
*   By default, all components integrated to the Component Directory are shown in Vault Configuration Report and Comparison Report.
