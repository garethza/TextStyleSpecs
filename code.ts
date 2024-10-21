async function displayTextStyleVariables() {
  try {
    // Load the "Inter" font asynchronously to ensure it's available for use
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });

    // Retrieve all local text styles in the current Figma document
    const textStyles = figma.getLocalTextStyles();
    console.log(`Found ${textStyles.length} text styles`);

    // If no text styles are found, notify the user and close the plugin
    if (textStyles.length === 0) {
      figma.notify("No text styles found.");
      figma.closePlugin();
      return;
    }

    // Get a mapping of mode IDs to mode names
    const modeNames = getModeNames();

    // Process and display the variable values for each text style
    resolveVariableValuesRecursively(textStyles, modeNames);

    // Notify the user that the text style variables have been displayed
    figma.notify("Text style variables displayed on canvas.");
    figma.closePlugin();

  } catch (error) {
    // Handle any errors that occur during the process
    console.error("Error displaying text style variables:", error);
    figma.notify("An error occurred while displaying text style variables.");
    figma.closePlugin();
  }
}

function resolveVariableValuesRecursively(textStyles: TextStyle[], modeNames: Record<string, string>) {
  // Create a new frame to contain the text nodes
  const frame = figma.createFrame();
  frame.name = "Text Style Properties";
  frame.layoutMode = "VERTICAL";
  frame.counterAxisSizingMode = "AUTO";
  frame.primaryAxisSizingMode = "AUTO";
  frame.paddingTop = 10;
  frame.paddingBottom = 10;
  frame.paddingLeft = 10;
  frame.paddingRight = 10;
  frame.itemSpacing = 10;

  // Iterate over each text style
  for (const textStyle of textStyles) {
    const boundVariables = textStyle.boundVariables;
    if (boundVariables) {
      // Create a text node for the text style name
      const textNode1 = figma.createText();
      textNode1.fontName = { family: "Inter", style: "Regular" };
      textNode1.fontSize = 24;
      textNode1.characters = `${textStyle.name}`;
      frame.appendChild(textNode1);

      // Iterate over each bound variable in the text style
      for (const [property, variableAlias] of Object.entries(boundVariables)) {
        const variableId = (variableAlias as any).id; // Get the variable ID
        const resolvedValue = resolveVariableValue(variableId, modeNames); // Resolve the variable value

        // Replace the property name if a replacement exists
        const replacedProperty = replaceProperty(property);
        console.log(`Original Property: ${property}, Replaced Property: ${replacedProperty}`); // Debug log

        // Create a text node for the replaced property and its resolved value
        const textNode2 = figma.createText();
        textNode2.fontName = { family: "Inter", style: "Regular" };
        textNode2.characters = `${replacedProperty}:\n${resolvedValue}`;
        frame.appendChild(textNode2);
      }
    }
  }

  // Add the frame to the current page and adjust the viewport to focus on it
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
}

function resolveVariableValue(variableId: string, modeNames: Record<string, string>): string {
  // Retrieve the variable by its ID
  const variable = figma.variables.getVariableById(variableId);
  if (!variable) {
    return "Variable not found";
  }

  // Get the variable name if it exists
  const variableName = variable.name ? `${variable.name}: ` : '';

  const valuesByMode = variable.valuesByMode;
  let resolvedValue = "";
  // Iterate over each mode and its corresponding value
  for (const [modeId, value] of Object.entries(valuesByMode)) {
    // Get the mode name
    let modeName = modeNames[modeId] || `Unknown Mode (${modeId})`;

    if (typeof value === 'object' && value !== null) {
      // If the value is another variable, resolve it recursively
      resolvedValue += `${modeName}: ${resolveVariableValue((value as any).id, modeNames)}\n`;
    } else {
      // Append the mode name and value to the resolved value string
      resolvedValue += `${modeName}: ${variableName}${value}\n`;
    }

    // Remove 'Default:' prefix if present after constructing resolvedValue
    resolvedValue = resolvedValue.replace(/^Default:\s*/, '');
  }
  return resolvedValue.trim(); // Trim any trailing whitespace
}

function replaceProperty(property: string): string {
  // Define a mapping of original property names to their replacements
  const propertyReplacements: Record<string, string> = {
    "fontSize": "Font Size",
    "fontFamily": "Font Family",
    "lineHeight": "Line Height",
    "fontWeight": "Font Weight",
    "letterSpacing": "Letter Spacing",
    "paragraphSpacing": "Paragraph Spacing",
    // Add more replacements as needed
  };

  // Log the property and its replacement for debugging
  console.log(`Original Property: ${property}, Replaced Property: ${propertyReplacements[property] || property}`);

  // Return the replacement if it exists, otherwise return the original property
  return propertyReplacements[property] || property;
}

function getModeNames(): Record<string, string> {
  const modeNames: Record<string, string> = {};
  // Retrieve all local variable collections
  const collections = figma.variables.getLocalVariableCollections();
  // Map each mode ID to its corresponding name
  for (const collection of collections) {
    for (const mode of collection.modes) {
      modeNames[mode.modeId] = mode.name;
    }
  }
  return modeNames;
}

// Start the process of displaying text style variables
displayTextStyleVariables();
