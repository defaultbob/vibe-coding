import json

def extract_nodes(node, level=0):
    indent = "  " * level
    name = node.get("name", "Unnamed")
    node_type = node.get("type", "Unknown")
    
    print(f"{indent}- {name} ({node_type})")
    
    # Extract text if available
    if "characters" in node:
        print(f"{indent}  Text: \"{node['characters']}\"")
        
    # Extract fills/colors
    if "fills" in node:
        fills = [f for f in node["fills"] if f.get("type") == "SOLID" and f.get("visible", True) != False]
        if fills:
            colors = []
            for f in fills:
                color = f.get("color", {})
                r = int(color.get("r", 0) * 255)
                g = int(color.get("g", 0) * 255)
                b = int(color.get("b", 0) * 255)
                colors.append(f"rgb({r}, {g}, {b})")
            if colors:
                print(f"{indent}  Fills: {', '.join(colors)}")

    if "children" in node:
        for child in node["children"]:
            extract_nodes(child, level + 1)

try:
    with open("figma_node_data.json", "r") as f:
        data = json.load(f)
        
    if "err" in data:
        print(f"Error from Figma API: {data['err']}")
    else:
        nodes = data.get("nodes", {})
        if not nodes:
            print("No nodes found in the response. Might be an invalid node ID or permissions issue.")
        for node_id, node_data in nodes.items():
            print(f"--- Node ID: {node_id} ---")
            document = node_data.get("document", {})
            extract_nodes(document)
except Exception as e:
    print(f"Error parsing JSON: {e}")