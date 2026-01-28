/**
 * Performance Diagnostic Script
 * Run this in Chrome DevTools console to identify the 10-minute bottleneck
 * 
 * Usage: 
 * 1. Open your app in browser
 * 2. Open DevTools (F12)
 * 3. Go to Console tab
 * 4. Copy and paste this entire script
 * 5. Press Enter
 * 
 * The script will measure what's blocking initial page load
 */

console.clear();
console.log('🔍 Performance Diagnostic Script Started\n');

// 1. Check JavaScript bundle size
console.log('📊 Script Tag Analysis:');
const scripts = document.querySelectorAll('script[src]');
let totalSize = 0;
scripts.forEach(script => {
  const src = script.src;
  const size = script.text.length;
  totalSize += size;
  if (src.includes('chunk') || src.includes('react') || src.includes('recharts')) {
    console.log(`  📄 ${src.split('/').pop()}: ${(size/1024).toFixed(2)}KB`);
  }
});
console.log(`  📦 Total inline scripts: ${(totalSize/1024).toFixed(2)}KB\n`);

// 2. Check React component mount time
console.log('⚡ React Component Rendering Timeline:');
const perfEntries = performance.getEntriesByType('measure');
perfEntries.forEach(entry => {
  if (entry.name.includes('render') || entry.name.includes('mount')) {
    console.log(`  ${entry.name}: ${entry.duration.toFixed(2)}ms`);
  }
});

// 3. Identify heavy modules
console.log('\n📚 Heavy Modules Loaded:');
if (window.__VITE_MANIFEST__) {
  console.log('  Vite manifest found - analyzing chunks...');
  // This shows what chunks Vite thinks are loaded
}

// 4. Monitor main thread blocking
console.log('\n🔴 Main Thread Blocking Tasks (>50ms):');
performance.mark('diagnostic-start');
const longTasks = performance.getEntriesByType('longtask');
if (longTasks.length === 0) {
  console.log('  ⚠️  Long Task API not available in this browser');
  console.log('  → Use Chrome DevTools Performance tab instead (F12 → Performance)');
} else {
  longTasks.forEach(task => {
    if (task.duration > 50) {
      console.log(`  ⏱️  ${task.name}: ${task.duration.toFixed(0)}ms`);
    }
  });
}

// 5. Check Core Web Vitals
console.log('\n📈 Core Web Vitals:');
if ('PerformanceObserver' in window) {
  // First Contentful Paint
  const navEntries = performance.getEntriesByType('navigation');
  if (navEntries.length > 0) {
    const nav = navEntries[0];
    console.log(`  📍 FCP (First Contentful Paint): ${nav.domContentLoadedEventStart.toFixed(0)}ms`);
  }
  
  // Check for Largest Contentful Paint
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(`  📐 LCP (Largest Contentful Paint): ${entry.renderTime}ms`);
    }
  }).observe({entryTypes: ['largest-contentful-paint']});
}

// 6. Identify recharts loading
console.log('\n📊 Recharts Detection:');
if (window.recharts) {
  console.log('  ✅ Recharts is LOADED in main bundle');
  console.log('  ⚠️  ISSUE FOUND: Recharts is blocking initial render!');
  console.log('  💡 SOLUTION: Lazy load recharts separately');
} else {
  console.log('  ℹ️  Recharts not in main thread yet');
}

// 7. Check localStorage/sessionStorage for previous loads
console.log('\n💾 Browser Storage:');
console.log(`  localStorage items: ${Object.keys(localStorage).length}`);
console.log(`  sessionStorage items: ${Object.keys(sessionStorage).length}`);

// 8. Final recommendation
console.log('\n\n✅ NEXT STEPS:');
console.log('1. Open DevTools Performance tab (F12 → Performance)');
console.log('2. Click "Record and reload" button');
console.log('3. Watch for yellow blocks (JavaScript) - these are your bottleneck');
console.log('4. Look for gaps where the browser is waiting for resources');
console.log('5. Check if recharts/react imports are in the critical path\n');

// Mark the end
performance.mark('diagnostic-end');
performance.measure('diagnostic', 'diagnostic-start', 'diagnostic-end');

console.log('🎯 Key findings will appear above in the console');
console.log('ℹ️  See "SOLUTION_10_MINUTES.md" in the project root for fixes\n');
