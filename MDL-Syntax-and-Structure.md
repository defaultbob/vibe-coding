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

