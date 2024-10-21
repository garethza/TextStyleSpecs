figma.showUI(__html__);

async function displayTextStyleVariables() {
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });

    const textStyles = figma.getLocalTextStyles();
    console.log(`Found ${textStyles.length} text styles`);

    if (textStyles.length === 0) {
      figma.notify("No text styles found.");
      return;
    }

    const modeNames = getModeNames();


    // After initial processing, resolve variable values recursively
    resolveVariableValuesRecursively(textStyles, modeNames);

  } catch (error) {
    console.error("Error displaying text style variables:", error);
    figma.notify("An error occurred while displaying text style variables.");
  }
}

function resolveVariableValuesRecursively(textStyles: TextStyle[], modeNames: Record<string, string>) {
  const frame = figma.createFrame();
  frame.name = "Resolved Variable Values";
  frame.layoutMode = "VERTICAL";
  frame.counterAxisSizingMode = "AUTO";
  frame.primaryAxisSizingMode = "AUTO";
  frame.paddingTop = 10;
  frame.paddingBottom = 10;
  frame.paddingLeft = 10;
  frame.paddingRight = 10;
  frame.itemSpacing = 10;

  for (const textStyle of textStyles) {
    const boundVariables = textStyle.boundVariables;
    if (boundVariables) {
      for (const [property, variableAlias] of Object.entries(boundVariables)) {
        const variableId = (variableAlias as any).id; // Adjust this line based on the actual structure
        const resolvedValue = resolveVariableValue(variableId, modeNames);
        const textNode = figma.createText();
        textNode.characters = `Resolved Value for ${textStyle.name}, Property: ${property}: ${resolvedValue}`;
        frame.appendChild(textNode);
        console.log(`Resolved Value for ${textStyle.name}, Property: ${property}: ${resolvedValue}`);
      }
    }
  }

  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
}

function resolveVariableValue(variableId: string, modeNames: Record<string, string>): any {
  const variable = figma.variables.getVariableById(variableId);
  if (!variable) {
    return "Variable not found";
  }

  const valuesByMode = variable.valuesByMode;
  let resolvedValue = "";
  for (const [modeId, value] of Object.entries(valuesByMode)) {
    const modeName = modeNames[modeId] || modeId; // Use mode name if available
    if (typeof value === 'object' && value !== null) {
      // If the value is another variable, resolve it recursively
      resolvedValue += `Mode: ${modeName}, Value: ${resolveVariableValue((value as any).id, modeNames)}; `;
    } else {
      resolvedValue += `Mode: ${modeName}, Value: ${value}; `;
    }
  }
  return resolvedValue;
}

function getModeNames(): Record<string, string> {
  const modeNames: Record<string, string> = {};
  const collections = figma.variables.getLocalVariableCollections();
  for (const collection of collections) {
    for (const mode of collection.modes) {
      modeNames[mode.modeId] = mode.name; // Ensure this maps modeId to the user-defined name
    }
  }
  return modeNames;
}

displayTextStyleVariables();
