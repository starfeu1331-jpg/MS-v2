/**
 * Script de diagnostic pour identifier les bottlenecks Vite
 * À exécuter dans le terminal: node scripts/diagnose-vite.js
 */

import fs from 'fs'
import path from 'path'

const srcDir = path.join(process.cwd(), 'src')

// Analyser les tailles des fichiers
const analyzeFiles = (dir, depth = 0) => {
  const files = fs.readdirSync(dir)
  let totalSize = 0

  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory() && depth < 3) {
      analyzeFiles(filePath, depth + 1)
    } else if (stat.isFile() && (file.endsWith('.tsx') || file.endsWith('.ts'))) {
      const sizeKb = (stat.size / 1024).toFixed(2)
      if (stat.size > 50000) { // Fichiers > 50kb
        console.log(`⚠️  GROS FICHIER: ${filePath} - ${sizeKb}kb`)
      }
      totalSize += stat.size
    }
  })

  return totalSize
}

console.log('🔍 Diagnostic Vite Performance\n')
console.log('📊 Analyse des tailles de fichiers...')
const totalSize = analyzeFiles(srcDir)
console.log(`\n✅ Total src: ${(totalSize / 1024).toFixed(2)}kb\n`)

// Vérifier les imports
console.log('🔎 Vérification des imports problématiques...')
const checkImports = (dir) => {
  const files = fs.readdirSync(dir)
  
  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory() && !file.includes('node_modules')) {
      checkImports(filePath)
    } else if (stat.isFile() && (file.endsWith('.tsx') || file.endsWith('.ts'))) {
      const content = fs.readFileSync(filePath, 'utf-8')
      
      // Chercher les imports problématiques
      if (content.includes("import * from") || content.includes("import * as")) {
        console.log(`⚠️  Import wildcard dans: ${filePath}`)
      }
      
      // Chercher les imports globaux de libs lourdes
      if ((file !== 'App.tsx') && content.includes("import") && 
          (content.includes("recharts") || content.includes("@tabler/icons") || content.includes("xlsx"))) {
        // C'est acceptable seulement dans les composants spécifiques
        if (!file.includes('Analysis') && !file.includes('Dashboard') && !file.includes('Panel')) {
          console.log(`ℹ️  Import de librairie dans ${file}`)
        }
      }
    }
  })
}

checkImports(srcDir)
console.log('\n✅ Diagnostic terminé!\n')
