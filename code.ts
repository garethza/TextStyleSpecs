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

async function createTextNodes() {
  try {
    const textStyles = await getTextStyles();
    console.log(`Found ${textStyles.length} text styles`);
    figma.notify(`Found ${textStyles.length} text styles`);
    
    if (textStyles.length > 0) {
      // Create a single auto layout frame
      const frame = figma.createFrame();
      frame.name = "Text Styles";
      frame.layoutMode = 'VERTICAL';
      frame.primaryAxisSizingMode = 'AUTO';
      frame.counterAxisSizingMode = 'AUTO';
      frame.x = 100;
      frame.y = 100;
      frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // White background
      frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = 16; // Add some padding
      frame.itemSpacing = 20; // Add spacing between text nodes

      // Get all modes in the document
      const modes = figma.variables.getLocalVariableCollections()
        .reduce((acc: string[], collection) => {
          return acc.concat(collection.modes.map(mode => mode.name));
        }, []);

      for (let index = 0; index < textStyles.length; index++) {
        console.log(`Processing style ${index + 1} of ${textStyles.length}`);
        figma.notify(`Processing style ${index + 1} of ${textStyles.length}`);
        const style = textStyles[index];
        
        console.log('Loading font...');
        try {
          await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
          console.log('Font loaded successfully');
        } catch (error) {
          console.error(`Error loading font:`, error);
          continue;
        }

        console.log('Creating text node...');
        const rowFrame = figma.createFrame();
        rowFrame.name = `Style: ${style.name}`;
        rowFrame.layoutMode = 'HORIZONTAL';
        rowFrame.primaryAxisSizingMode = 'AUTO';
        rowFrame.counterAxisSizingMode = 'AUTO';
        rowFrame.itemSpacing = 16;
        rowFrame.fills = [];

        const baseInfoNode = figma.createText();
        baseInfoNode.name = "Base Info";
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
        
        // Set an initial width, then resize to fit content
        baseInfoNode.resize(300, baseInfoNode.height);
        baseInfoNode.resize(baseInfoNode.width, baseInfoNode.height);
        
        rowFrame.appendChild(baseInfoNode);

        // Add columns for each mode
        for (const mode of modes) {
          const modeNode = figma.createText();
          modeNode.name = `Mode: ${mode}`;
          modeNode.textAutoResize = "WIDTH_AND_HEIGHT";
          modeNode.characters = `Mode: ${mode}\n`;
          // Get variable values for this mode
          for (const key in style) {
            const value = style[key];
            if (key === 'fontSize') {
              if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'VARIABLE_ALIAS') {
                const variable = figma.variables.getVariableById(value.id);
                if (variable) {
                  const modeValue = variable.valuesByMode[mode];
                  modeNode.characters += `Font Size: ${modeValue !== undefined ? `${modeValue}px` : '[Not set]'}\n`;
                }
              } else {
                // If fontSize is not a variable, use the base value for all modes
                modeNode.characters += `Font Size: ${value}px\n`;
              }
            } else if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'VARIABLE_ALIAS') {
              const variable = figma.variables.getVariableById(value.id);
              if (variable) {
                const modeValue = variable.valuesByMode[mode];
                modeNode.characters += `${key}: ${modeValue !== undefined ? modeValue : '[Not set]'}\n`;
              }
            }
          }

          modeNode.fontSize = 14;
          modeNode.textAlignHorizontal = 'LEFT';
          modeNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
          
          // Set an initial width, then resize to fit content
          modeNode.resize(200, modeNode.height);
          modeNode.resize(modeNode.width, modeNode.height);
          
          rowFrame.appendChild(modeNode);
        }

        frame.appendChild(rowFrame);
        console.log('Row created and styled successfully');
      }

      // After adding all rows, resize the frame to fit its contents
      frame.resize(
        frame.width,
        frame.height
      );

      figma.currentPage.selection = [frame];
      figma.viewport.scrollAndZoomIntoView([frame]);
    } else {
      figma.notify("No text styles defined in this file.");
    }
  } catch (error) {
    console.error("Error in createTextNodes:", error);
    figma.notify("An error occurred while processing text styles.");
  }
}

// Run the main function and then close the plugin
createTextNodes().then(() => {
  console.log("Plugin execution completed.");
  figma.notify("Plugin execution completed.");
  figma.closePlugin();
}).catch((error) => {
  console.error("Error running plugin:", error);
  figma.notify("An error occurred while running the plugin.");
  figma.closePlugin();
});
