# Spec: Extracting Record (Data) Dependencies in Vault MDL

## Objective
Update the dependency extractor tool to explicitly capture and decouple **record (data) dependencies** from **metadata (schema) dependencies**. Currently, the extractor conflates a reference to a specific data record (e.g., a specific User, Country, or Group) with a schema dependency on the Object definition itself.

The goal is to transition from hardcoded, environment-specific record identifiers (like usernames or names) in `.mdl` files to immutable, globally unique IDs that are mapped via a centralized lookup file.

## Problem Statement
In Vault MDL, certain properties reference data records rather than schema components. For example:
- `owner('user:User.System')` or `owner('user:john.doe@veeva.com')`
- `group:Group.all_internal_users__v`
- Hardcoded references to object records, like a specific `country__v` name (e.g., `'USA'`).

Currently, the extractor:
1. Leaves the hardcoded, environment-specific identifier (e.g., `john.doe@veeva.com`) directly in the `.mdl` file.
2. Inaccurately translates this into a `.d` file schema dependency on `Object.user__sys` or `Object.group__sys`.

This creates migration and parsing failures across environments, as record names/emails differ between Vaults.

## Proposed Solution

The extractor tool should be updated to implement a **Data Dependency Decoupling** pattern using immutable IDs and a centralized manifest.

### 1. Entity Record Manifests (`.manifest.csv` files)
Instead of a single centralized registry, the extractor must generate a `.manifest.csv` file for each Entity type (e.g., `user__sys.manifest.csv`, `group__sys.manifest.csv`, `country__v.manifest.csv`, `application_role__v.manifest.csv`) in a dedicated directory. These files map the immutable global IDs to their environment-specific names/values using a simple CSV format.

**Format:**
```csv
id,name
```

**ID Formatting Rules:**
- **Users (`user__sys`):** IDs must be numeric integers (e.g., `1`, `452`).
- **Application Roles (`application_role__v`):** IDs must use the Vault standard alphanumeric format (e.g., `OOU0000000QD013`). Note: These often appear in MDL as `Applicationrole.name__v`, mimicking component syntax, but they are data references.
- **Other Objects:** IDs must use the Vault standard alphanumeric format (e.g., `OOU0000000QD013`).

**Example: `application_role__v.manifest.csv`**
```csv
id,name
OOU0000000AK001,approver__v
OOU0000000AK002,editor__v
```

**Example: `user__sys.manifest.csv`**
```csv
id,name
1,System
452,john.doe@veeva.com
```

### 2. .mdl File Updates (Immutable References)
When the extractor parses an `.mdl` file and encounters a record reference, it should replace the hardcoded string with the immutable ID mapped from the entity's manifest.

**Special Note on Applicationrole:**
References like `role('Applicationrole.approver__v')` should be treated as record references.

**Before (Current State):**
```mdl
RECREATE Objectlifecycle user_task_lifecycle__v (
   Objectlifecyclerole owner__v(
      application_role('Applicationrole.owner__v'),
      ...
   )
)
```

**After (Desired State):**
```mdl
RECREATE Objectlifecycle user_task_lifecycle__v (
   Objectlifecyclerole owner__v(
      application_role('record:OOU0000000AK003'),
      ...
   )
)
```

### 3. .d File Updates (Explicit Record Dependencies)
The `.d` files should explicitly declare these as **Record** dependencies rather than confusing them with **Object** (schema) dependencies. Note that an `Applicationrole` reference creates a dependency on the specific **Record ID**, and logically implies a schema dependency on `Object.application_role__v`.

**Before (Current State):**
```text
depends_on: Object.user__sys [blocking=true]
```

**After (Desired State):**
```text
depends_on: Record.1 [blocking=true]
depends_on: Record.OOU0000000AK003 [blocking=true]
```

## Parsing Logic for the Extractor
To implement this, the extractor's parsing logic should be updated as follows:

1. **Regex Matching:** Identify known record reference patterns in `.mdl` strings:
   - `user:(.*)` -> Maps to the `user__sys.manifest`
   - `group:(.*)` -> Maps to the `group__sys.manifest`
   - Specific fields known to lookup records (e.g., default values for object reference fields).
2. **ID Generation:** When a match is found, check if the `name` (e.g., `System` or `all_internal_users__v`) exists in the respective entity's `.manifest` file.
   - If yes, retrieve the existing ID.
   - If no, generate a new ID adhering to the formatting rules (numeric for users, alphanumeric for other objects), add it to the manifest, and map it.
3. **Replacement:** Rewrite the `.mdl` output to use `record:ID` (e.g., `record:1` or `record:OOU0000000QD013`).
4. **Dependency Graphing:** Write `depends_on: Record.ID` to the `.d` file.

## Benefits
- **Environment Agnostic:** Configuration packages can be deployed across DEV/QA/PROD Vaults without manually rewriting usernames or data records. The deployment engine just updates the manifest mapping.
- **Accurate Graphs:** `.d` files will accurately reflect that a component depends on a *specific piece of data* existing, not just the schema definition of the object.