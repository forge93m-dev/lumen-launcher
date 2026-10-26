// Lumen Client modules: curated Fabric mods that can be toggled per instance.
// `slug` is the Modrinth project slug; `preset` marks the one-click essentials pack.
module.exports = [
  // Performance
  { slug: 'sodium', cat: 'Performance', name: 'Sodium', desc: 'Rewritten renderer. Often doubles or triples your FPS.', preset: true },
  { slug: 'lithium', cat: 'Performance', name: 'Lithium', desc: 'Optimizes game logic, physics and AI without changing behaviour.', preset: true },
  { slug: 'ferrite-core', cat: 'Performance', name: 'FerriteCore', desc: 'Cuts RAM usage dramatically.', preset: true },
  { slug: 'entityculling', cat: 'Performance', name: 'Entity Culling', desc: 'Skips rendering entities and block entities you cannot see.', preset: true },
  { slug: 'immediatelyfast', cat: 'Performance', name: 'ImmediatelyFast', desc: 'Faster HUD, text and entity rendering.', preset: true },
  { slug: 'modernfix', cat: 'Performance', name: 'ModernFix', desc: 'Faster startup and world loading, lower memory.' },
  { slug: 'dynamic-fps', cat: 'Performance', name: 'Dynamic FPS', desc: 'Lowers FPS when the game is in the background to save power.', preset: true },
  { slug: 'moreculling', cat: 'Performance', name: 'More Culling', desc: 'Extra culling for leaves, item frames and more.' },

  // Visual
  { slug: 'iris', cat: 'Visual', name: 'Shaders (Iris)', desc: 'Load shader packs. Browse shaders in the Browse tab.' },
  { slug: 'zoomify', cat: 'Visual', name: 'Zoom', desc: 'Smooth, configurable zoom key (C by default).', preset: true },
  { slug: '3dskinlayers', cat: 'Visual', name: '3D Skin Layers', desc: 'Renders the outer skin layer in 3D.' },
  { slug: 'continuity', cat: 'Visual', name: 'Connected Textures', desc: 'Seamless glass and connected textures for resource packs.' },
  { slug: 'lambdynamiclights', cat: 'Visual', name: 'Dynamic Lights', desc: 'Torches in hand light up the area around you.' },
  { slug: 'not-enough-animations', cat: 'Visual', name: 'Better Animations', desc: 'Third-person animations for eating, maps, ladders and more.' },
  { slug: 'wavey-capes', cat: 'Visual', name: 'Wavey Capes', desc: 'Capes flow with physics instead of a flat plane.' },
  { slug: 'cull-leaves', cat: 'Visual', name: 'Cull Leaves', desc: 'Hollow leaf blocks for clean visuals and more FPS.' },

  // HUD
  { slug: 'betterf3', cat: 'HUD', name: 'Better F3', desc: 'A clean, colored and customizable debug screen.' },
  { slug: 'appleskin', cat: 'HUD', name: 'AppleSkin', desc: 'Shows food saturation and hunger restored on the HUD.' },
  { slug: 'xaeros-minimap', cat: 'HUD', name: 'Minimap', desc: "Xaero's minimap with waypoints." },
  { slug: 'xaeros-world-map', cat: 'HUD', name: 'World Map', desc: 'Full-screen explored world map.' },
  { slug: 'jade', cat: 'HUD', name: 'Block Info (Jade)', desc: 'Tooltip with info about the block or mob you look at.' },
  { slug: 'chat-heads', cat: 'HUD', name: 'Chat Heads', desc: "Shows a player's head next to their chat messages." },

  // Utility
  { slug: 'modmenu', cat: 'Utility', name: 'Mod Menu', desc: 'In-game list of modules with settings buttons.', preset: true },
  { slug: 'mouse-tweaks', cat: 'Utility', name: 'Mouse Tweaks', desc: 'Faster inventory management with drag and scroll.' },
  { slug: 'shulkerboxtooltip', cat: 'Utility', name: 'Shulker Preview', desc: 'See shulker box contents in the tooltip.' },
  { slug: 'no-chat-reports', cat: 'Utility', name: 'No Chat Reports', desc: 'Strips chat signatures for privacy.' },
  { slug: 'borderless-mining', cat: 'Utility', name: 'Borderless Fullscreen', desc: 'Fullscreen that alt-tabs instantly.' },
  { slug: 'fastquit', cat: 'Utility', name: 'Fast Quit', desc: 'Return to title instantly while the world saves in the background.' },

  // Audio
  { slug: 'sound-physics-remastered', cat: 'Audio', name: 'Sound Physics', desc: 'Realistic reverb, occlusion and echo.' },
  { slug: 'presence-footsteps', cat: 'Audio', name: 'Presence Footsteps', desc: 'Detailed footstep sounds for every surface.' },
];
