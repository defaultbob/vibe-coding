# Veeva Vault MDL Syntax & Component Structure

This document outlines the directory structure and the configuration syntax (MDL - Vault Metadata Language) used for Vault Components within this project.

## Directory Structure
Vault configurations are organized into a strict component-based directory structure. The root `components/` folder contains subdirectories, each representing a top-level Vault Component Type (e.g., `Object`, `Doctype`, `Docfield`, `Lifecyclestatetype`).

```text
components/
├── Object/                 # Base object definitions
├── Objecttype/             # Sub-types of Objects
├── Doctype/                # Base Document Types and their sub-types
├── Docfield/               # Fields associated with Document Types
├── Lifecyclestatetype/     # Lifecycle state definitions
├── Layout/                 # Page Layouts
└── ...                     # Other component directories
```

### File Naming and Parent-Child Relationships
File names within component folders often establish implicit parent-child relationships, separated by a dot (`.`).
- **Doctype:** `finance__c.invoice_uploads__c.mdl` indicates a document type `invoice_uploads__c` that is a subtype (child) of the `finance__c` doctype.
- **Objecttype:** `activity__v.user_task__v.mdl` indicates the `user_task__v` type belongs to the `activity__v` object.

## MDL Syntax (Metadata Language)
Vault MDL is a declarative, DML-like syntax used to define the schema and properties of Vault configuration components.

### 1. Component Type Schema
* Component types have a well defined schema
* Schema can be retrieved from the "Use Retrieve Component Type Metadata" endpoint and is included as a METADATA-*.json file in the component type folder in the file system.
* 
* 

### 2. Component Declaration
Every component configuration file begins with a `RECREATE` or `ALTER` statement followed by the Component Type and Component Name.

```mdl
RECREATE Doctype corporate__c (
   label('Corporate'),
   description('Corporate Documents'),
   active(true),
   ...
);
```

### 3. Attributes
Attributes of the component are defined as function-like assignments inside the declaration:
- `label('...')`
- `active(true)`
- `object_class('base')`

### 4. Subcomponents (e.g., Fields in an Object)
Some components, like `Object`, contain nested subcomponents such as `Field` directly within the same declaration. Subcomponents also have a type e.g. Field and a name e.g. activity_state__v following the same naming conventions as components:

```mdl
RECREATE Object activity__v (
   label('Activity'),
   active(true),
   Field activity_state__v(
      label('State'),
      type('String'),
      required(false),
      list_column(true)
   )
);
```

Subcomponents are children of the component, names are unique within that subcomponent type and component. One component type can have multiple subcomponent types.

### 5. Relationships and References

#### Dependency Records


#### In the MDL syntax

Relationships between components are established via specific properties, for example:
- **`lookup_relationship_name()` / `lookup_source_field()`**: Defines lookup relationships between Objects/Fields.
- **`available_lifecycles()`**: Links Objects or Doctypes to specific Lifecycles.
- **`security_tree_object()`**: Links an object to a security tree object.

Understanding these naming conventions, syntax declarations, and property references is critical for correctly parsing the configurations and rendering their hierarchies and relationships within the Admin UI.

**Reference Values**
Reference values are typically like `Object.activity__v`. Subcomponent references like `Field.created_by__sys`. Subcomponent reference attributes are typically paired with another attribute that references the component that subcomponent belongs to.

### 6. Dependency Parsing & Linking (.d files vs MDL)

Vault provides `.d` (dependency) files alongside `.mdl` files during code export. These files contain explicit relationship graphs of what a component requires (e.g. `depends_on: Object.checklist_design__sys [blocking=true]`).

When parsing dependencies purely from `.mdl` text, we encounter several challenges:

1. **Explicit Fully Qualified Names (FQDNs)**
   Many dependencies use a `Category.name` format (e.g., `Object.invoice__c` or `Page.process_monitor__sys`). These are straightforward to parse.
   
2. **Implicit References**
   Some properties only contain the component name (e.g., `lookup_relationship_name('account__c')`). To resolve these, a parser must maintain an in-memory registry of all known components and their categories to guess that `account__c` belongs to the `Object` category.

3. **Contextual References in Strings/XML**
   Certain components like `Dashboard` use XML blocks (`dashboard_markup({...})`) where dependencies are embedded as attributes (e.g., `report="Report.english_definitions__c"`). Others, like `Actiontrigger` scripts, reference components via variables (e.g., `$big_order__c`), requiring heuristic matching.

#### Deep/Logical Dependencies
Some dependencies are inferred from Vault's internal schema rather than the raw text:
- **Record References:** The `owner('user:User.System')` attribute on a `Job` implicitly creates a data dependency on a specific User record. The literal string `user__sys` never appears in the `.mdl`. Similarly, `Applicationrole.*` strings in workflows map to specific records in the `application_role__v` object.
- **Object Lifecycles:** `Objectlifecycle` components inherently belong to a specific Object, but the `.mdl` file for the lifecycle contains no text linking back to it. Instead, the link is only found inside the Object's `available_lifecycles()` attribute. Parsing the lifecycle alone requires guessing the object name (e.g., stripping `_lifecycle` from the name to guess the base object).

#### Proposed MDL Syntax Improvements for Dependency Parsing
To make `.mdl` files purely declarative and easy to parse without a running Vault instance (like a traditional compiler):
- **Universal FQDNs**: Mandate `Category.name` format for *all* references. Instead of `lookup_relationship_name('account__c')`, use `lookup_relationship_name('Object.account__c')`.
- **Explicit Imports**: Introduce an `imports()` or `depends_on()` block at the top of the `.mdl` file (similar to Java or Python) to list all dependencies used in embedded scripts, formulas, or XML payloads. This would remove the need to parse arbitrary strings or ActionScript to find dependencies.
- **Explicit Parent Linking**: Add a `target_object('Object.name__c')` attribute to `Objectlifecycle` components so the file declares its owner, rather than relying on the object to claim the lifecycle.

