/*// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This plugin creates rectangles on the screen.
const numberOfRectangles = 5;

const nodes: SceneNode[] = [];
for (let i = 0; i < numberOfRectangles; i++) {
  const rect = figma.createRectangle();
  rect.x = i * 150;
  rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0.5, b: 0 } }];
  figma.currentPage.appendChild(rect);
  nodes.push(rect);
}
figma.currentPage.selection = nodes;
figma.viewport.scrollAndZoomIntoView(nodes);

// Make sure to close the plugin when you're done. Otherwise the plugin will
// keep running, which shows the cancel button at the bottom of the screen.
figma.closePlugin();
*/

figma.notify("Plugin is running!");

// Get all defined text styles in the current Figma document
async function getTextStyles() {
  return await figma.getLocalTextStylesAsync();
}

// Helper functions to format letter spacing and line height
function formatLetterSpacing(letterSpacing: LetterSpacing | VariableAlias): string {
  if (typeof letterSpacing === 'object' && 'type' in letterSpacing && letterSpacing.type === 'VARIABLE_ALIAS') {
    return '[Variable]';
  }
  if (typeof letterSpacing === 'number') {
    return `${letterSpacing}px`;
  } else if ('value' in letterSpacing && 'unit' in letterSpacing) {
    const value = letterSpacing.value * 100; // Round to 2 decimal places
    return `${value}${letterSpacing.unit === 'PERCENT' ? '%' : 'px'}`;
  } else {
    return '[Unknown]';
  }
}

function formatLineHeight(lineHeight: LineHeight | VariableAlias): string {
  if (typeof lineHeight === 'object' && 'type' in lineHeight && lineHeight.type === 'VARIABLE_ALIAS') {
    return '[Variable]';
  }
  if (typeof lineHeight === 'object' && 'unit' in lineHeight && lineHeight.unit === 'AUTO') return 'Auto';
  if (typeof lineHeight === 'number') {
    return `${lineHeight}px`;
  } else if ('value' in lineHeight && 'unit' in lineHeight) {
    const value = lineHeight.value;
    return `${value}${lineHeight.unit === 'PERCENT' ? '%' : 'px'}`;
  } else {
    return '[Unknown]';
  }
}

function getAssignedVariableName(style: TextStyle): string {
  if (style.boundVariables && style.boundVariables.fontSize) {
    const fontSizeVariable = figma.variables.getVariableById(style.boundVariables.fontSize.id);
    return fontSizeVariable ? fontSizeVariable.name : 'Unknown Variable';
  }
  return 'None';
}

function getVariableValue(variableId: string, mode: string): { name: string, value: any } | null {
  console.log(`Debug - getVariableValue called with variableId: ${variableId}, mode: ${mode}`);
  const variable = figma.variables.getVariableById(variableId);
  if (!variable) {
    console.log(`Debug - Variable not found for id: ${variableId}`);
    return null;
  }

  let currentName = variable.name;
  let currentValue = variable.valuesByMode[mode];
  let depth = 0;
  const maxDepth = 10; // Prevent infinite loops

  while (typeof currentValue === 'object' && currentValue !== null && 'type' in currentValue && currentValue.type === 'VARIABLE_ALIAS' && depth < maxDepth) {
    console.log(`Debug - Value is an alias, resolving... (depth: ${depth})`);
    const resolvedVariable = figma.variables.getVariableById(currentValue.id);
    if (!resolvedVariable) {
      console.log(`Debug - Aliased variable not found for id: ${currentValue.id}`);
      return null;
    }
    currentName += ` → ${resolvedVariable.name}`;
    currentValue = resolvedVariable.valuesByMode[mode];
    console.log(`Debug - Resolved to:`, currentValue);
    depth++;
  }

  if (depth === maxDepth) {
    console.log(`Debug - Max depth reached, possible circular reference`);
    return { name: currentName, value: 'Circular Reference' };
  }

  if (currentValue === undefined) {
    console.log(`Debug - No value defined for mode ${mode}`);
    return null;
  }

  console.log(`Debug - Final resolved value:`, currentValue);
  return { name: currentName, value: currentValue };
}

// Define a constant to limit the number of text styles processed
const TEXT_STYLE_LIMIT = 5;

function getRawVariableValue(variableInfo: { name: string, value: any } | null, mode: string): any {
  if (!variableInfo) {
    console.log(`Variable info is null`);
    return null;
  }

  let currentValue = variableInfo.value;
  let depth = 0;
  const maxDepth = 10; // Prevent infinite loops

  while (typeof currentValue === 'object' && currentValue !== null && 'type' in currentValue && currentValue.type === 'VARIABLE_ALIAS' && depth < maxDepth) {
    const resolvedVariable = figma.variables.getVariableById(currentValue.id);
    if (!resolvedVariable) {
      console.log(`Aliased variable not found for id: ${currentValue.id}`);
      return 'Aliased variable not found';
    }
    currentValue = resolvedVariable.valuesByMode[mode];
    depth++;
  }

  if (depth === maxDepth) {
    console.log(`Max depth reached, possible circular reference`);
    return 'Circular Reference';
  }

  return currentValue;
}

function getRawVariableValuesAcrossModes(variableId: string): { modeName: string, rawValue: any }[] {
  const variable = figma.variables.getVariableById(variableId);
  if (!variable) {
    console.log(`Variable not found for id: ${variableId}`);
    return [];
  }

  const modeValues: { modeName: string, rawValue: any }[] = [];
  const modeMap = figma.variables.getLocalVariableCollections()
    .reduce((acc: { [key: string]: string }, collection) => {
      collection.modes.forEach(mode => {
        acc[mode.name] = mode.modeId;
      });
      return acc;
    }, {});

  for (const modeName in modeMap) {
    const modeId = modeMap[modeName];
    let currentValue = variable.valuesByMode[modeId];
    let depth = 0;
    const maxDepth = 10; // Prevent infinite loops

    while (typeof currentValue === 'object' && currentValue !== null && 'type' in currentValue && currentValue.type === 'VARIABLE_ALIAS' && depth < maxDepth) {
      const resolvedVariable = figma.variables.getVariableById(currentValue.id);
      if (!resolvedVariable) {
        console.log(`Aliased variable not found for id: ${currentValue.id}`);
        currentValue = 'Aliased variable not found';
        break;
      }
      currentValue = resolvedVariable.valuesByMode[modeId];
      depth++;
    }

    if (depth === maxDepth) {
      console.log(`Max depth reached, possible circular reference`);
      currentValue = 'Circular Reference';
    }

    modeValues.push({ modeName, rawValue: currentValue });
  }

  return modeValues;
}

async function createTextNodes(rawValues: { modeName: string, rawValue: any }[]) {
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });

    const textStyles = await getTextStyles();
    console.log(`Found ${textStyles.length} text styles`);
    figma.notify(`Found ${textStyles.length} text styles`);
    
    if (textStyles.length > 0) {
      const frame = figma.createFrame();
      frame.name = "Text Styles";
      frame.layoutMode = 'VERTICAL';
      frame.primaryAxisSizingMode = 'AUTO';
      frame.counterAxisSizingMode = 'AUTO';
      frame.x = 100;
      frame.y = 100;
      frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = 16;
      frame.itemSpacing = 20;

      // Get all modes and their identifiers
      const modeMap = figma.variables.getLocalVariableCollections()
        .reduce((acc: { [key: string]: string }, collection) => {
          collection.modes.forEach(mode => {
            acc[mode.name] = mode.modeId; // Map mode name to mode id
          });
          return acc;
        }, {});

      // Limit the number of text styles processed
      const stylesToProcess = textStyles.slice(0, TEXT_STYLE_LIMIT);

      for (let index = 0; index < stylesToProcess.length; index++) {
        console.log(`Processing style ${index + 1} of ${stylesToProcess.length}`);
        figma.notify(`Processing style ${index + 1} of ${stylesToProcess.length}`);
        const style = stylesToProcess[index];
        
        if (style.fontName) {
          await figma.loadFontAsync(style.fontName);
        }

        const rowFrame = figma.createFrame();
        rowFrame.name = `Style: ${style.name}`;
        rowFrame.layoutMode = 'HORIZONTAL';
        rowFrame.primaryAxisSizingMode = 'AUTO';
        rowFrame.counterAxisSizingMode = 'AUTO';
        rowFrame.itemSpacing = 16;
        rowFrame.fills = [];

        const baseInfoNode = figma.createText();
        baseInfoNode.name = "Base Info";
        baseInfoNode.fontName = { family: "Inter", style: "Regular" };
        baseInfoNode.textAutoResize = "WIDTH_AND_HEIGHT";
        baseInfoNode.characters = `
Style Name: ${style.name}
Font Family: ${style.fontName?.family || '[Unknown]'}
Font Style: ${style.fontName?.style || '[Unknown]'}
Font Size: ${style.fontSize !== undefined ? `${style.fontSize}px` : '[Unknown]'}
Letter Spacing: ${formatLetterSpacing(style.letterSpacing)}
Line Height: ${formatLineHeight(style.lineHeight)}
        `.trim();
        baseInfoNode.fontSize = 14;
        baseInfoNode.textAlignHorizontal = 'LEFT';
        baseInfoNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
        
        baseInfoNode.resize(300, baseInfoNode.height);
        baseInfoNode.resize(baseInfoNode.width, baseInfoNode.height);
        
        rowFrame.appendChild(baseInfoNode);

        for (const modeName in modeMap) {
          const modeId = modeMap[modeName];
          const modeNode = figma.createText();
          modeNode.name = `Mode: ${modeName}`;
          modeNode.fontName = { family: "Inter", style: "Regular" };
          modeNode.textAutoResize = "WIDTH_AND_HEIGHT";

          const modeStyle = await figma.getStyleByIdAsync(style.id) as TextStyle | null;
          
          console.log(`Debug - Mode: ${modeName}, Style ID: ${style.id}`);
          console.log(`Debug - ModeStyle:`, modeStyle);

          if (modeStyle) {
            if (modeStyle.fontName) {
              await figma.loadFontAsync(modeStyle.fontName);
            }

            let fontSizeInfo = 'Unknown';
            let assignedVariableName = getAssignedVariableName(modeStyle);

            console.log(`Debug - Assigned Variable Name: ${assignedVariableName}`);
            console.log(`Debug - Bound Variables:`, modeStyle.boundVariables);

            if (modeStyle.boundVariables && modeStyle.boundVariables.fontSize) {
              console.log(`Debug - Font size is bound to a variable`);
              const variableInfo = getVariableValue(modeStyle.boundVariables.fontSize.id, modeId);
              console.log(`Debug - Variable Info:`, variableInfo);
              if (variableInfo) {
                fontSizeInfo = `${variableInfo.name}: ${variableInfo.value}px`;
                console.log(`Debug - Font Size Info: ${fontSizeInfo}`);
              } else {
                fontSizeInfo = 'No value defined for this mode';
              }
            } else if (typeof modeStyle.fontSize === "number") {
              console.log(`Debug - Font size is a direct value: ${modeStyle.fontSize}`);
              fontSizeInfo = `Direct value: ${modeStyle.fontSize}px`;
            } else {
              console.log(`Debug - Unexpected font size type:`, modeStyle.fontSize);
              fontSizeInfo = `Unexpected type: ${typeof modeStyle.fontSize}`;
            }

            modeNode.characters = `Mode: ${modeName}\n`;
            modeNode.characters += `Assigned Variable: ${assignedVariableName}\n`;
            modeNode.characters += `Font Size: ${fontSizeInfo}\n`;
          } else {
            modeNode.characters = `Mode: ${modeName}\nStyle not available for this mode`;
            console.log(`Debug - Style not available for mode: ${modeName}`);
          }

          modeNode.fontSize = 14;
          modeNode.textAlignHorizontal = 'LEFT';
          modeNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
          
          modeNode.resize(200, modeNode.height);
          modeNode.resize(modeNode.width, modeNode.height);
          
          rowFrame.appendChild(modeNode);
        }

        frame.appendChild(rowFrame);
      }

      // Create a new frame for raw variable values
      const rawValuesFrame = figma.createFrame();
      rawValuesFrame.name = "Raw Variable Values";
      rawValuesFrame.layoutMode = 'VERTICAL';
      rawValuesFrame.primaryAxisSizingMode = 'AUTO';
      rawValuesFrame.counterAxisSizingMode = 'AUTO';
      rawValuesFrame.x = frame.x + frame.width + 50; // Position it next to the main frame
      rawValuesFrame.y = frame.y;
      rawValuesFrame.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
      rawValuesFrame.paddingLeft = rawValuesFrame.paddingRight = rawValuesFrame.paddingTop = rawValuesFrame.paddingBottom = 16;
      rawValuesFrame.itemSpacing = 10;

      // Populate the raw values frame
      for (let index = 0; index < stylesToProcess.length; index++) {
        const style = stylesToProcess[index];
        const rawValueNode = figma.createText();
        rawValueNode.fontName = { family: "Inter", style: "Regular" };
        rawValueNode.textAutoResize = "WIDTH_AND_HEIGHT";

        let rawValueText = `Style: ${style.name}\n`;

        for (const modeName in modeMap) {
          const modeId = modeMap[modeName];
          if (style.boundVariables && style.boundVariables.fontSize) {
            const variableInfo = getVariableValue(style.boundVariables.fontSize.id, modeId);
            const rawValue = getRawVariableValue(variableInfo, modeId);
            rawValueText += `Mode: ${modeName}, Raw Value: ${rawValue}\n`;
          }
        }

        rawValueNode.characters = rawValueText;
        rawValueNode.fontSize = 14;
        rawValueNode.textAlignHorizontal = 'LEFT';
        rawValueNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];

        rawValuesFrame.appendChild(rawValueNode);
      }

      figma.currentPage.appendChild(frame);
      figma.currentPage.appendChild(rawValuesFrame);
      figma.viewport.scrollAndZoomIntoView([frame, rawValuesFrame]);
    } else {
      figma.notify("No text styles defined in this file.");
    }
  } catch (error) {
    console.error("Error in createTextNodes:", error);
    figma.notify("An error occurred while processing text styles.");
  }
}

// Add a cancel button
figma.showUI(__html__, { width: 300, height: 200 });

// Send available collections to the UI
const collections = figma.variables.getLocalVariableCollections().map(collection => ({
  id: collection.id,
  name: collection.name
}));

figma.ui.postMessage({ type: 'populate-collections', collections });

// Function to resolve a variable value, handling aliases
function resolveVariableValue(variableId: string, modeId: string): any {
  let currentValue = figma.variables.getVariableById(variableId)?.valuesByMode[modeId];
  let depth = 0;
  const maxDepth = 10; // Prevent infinite loops

  while (typeof currentValue === 'object' && currentValue !== null && 'type' in currentValue && currentValue.type === 'VARIABLE_ALIAS' && depth < maxDepth) {
    const resolvedVariable = figma.variables.getVariableById(currentValue.id);
    if (!resolvedVariable) {
      console.log(`Aliased variable not found for id: ${currentValue.id}`);
      return 'Aliased variable not found';
    }
    currentValue = resolvedVariable.valuesByMode[modeId];
    depth++;
  }

  if (depth === maxDepth) {
    console.log(`Max depth reached, possible circular reference`);
    return 'Circular Reference';
  }

  return currentValue;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'select-collection') {
    const collectionId = msg.collectionId;
    const collection = figma.variables.getLocalVariableCollections().find(c => c.id === collectionId);
    if (collection) {
      if (!collection.variableIds || collection.variableIds.length === 0) {
        figma.notify("No variables found in the selected collection.");
        return;
      }

      // Create a frame to display all variables
      const rawValuesFrame = figma.createFrame();
      rawValuesFrame.name = "Variables in Collection";
      rawValuesFrame.layoutMode = 'VERTICAL';
      rawValuesFrame.primaryAxisSizingMode = 'AUTO';
      rawValuesFrame.counterAxisSizingMode = 'AUTO';
      rawValuesFrame.x = 100;
      rawValuesFrame.y = 100;
      rawValuesFrame.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
      rawValuesFrame.paddingLeft = rawValuesFrame.paddingRight = rawValuesFrame.paddingTop = rawValuesFrame.paddingBottom = 16;
      rawValuesFrame.itemSpacing = 10;

      // Iterate over each variable in the collection
      for (const variableId of collection.variableIds) {
        const variable = figma.variables.getVariableById(variableId);
        if (variable) {
          const modeId = figma.variables.getLocalVariableCollections().find(c => c.id === collectionId)?.modes[0]?.modeId || '';
          const resolvedValue = resolveVariableValue(variableId, modeId);

          const variableNode = figma.createText();
          await figma.loadFontAsync({ family: "Inter", style: "Regular" });
          variableNode.fontName = { family: "Inter", style: "Regular" };
          variableNode.textAutoResize = "WIDTH_AND_HEIGHT";
          variableNode.characters = `
            Variable Name: ${variable.name}
            Variable ID: ${variable.id}
            Resolved Value: ${resolvedValue}
          `.trim();
          variableNode.fontSize = 14;
          variableNode.textAlignHorizontal = 'LEFT';
          variableNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];

          rawValuesFrame.appendChild(variableNode);
        }
      }

      figma.currentPage.appendChild(rawValuesFrame);
      figma.viewport.scrollAndZoomIntoView([rawValuesFrame]);

      figma.notify("Variables displayed in the frame.");
    }
  } else if (msg.type === 'cancel') {
    figma.closePlugin("Plugin cancelled by user");
  }
};

