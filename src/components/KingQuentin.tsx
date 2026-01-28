import { Crown } from 'lucide-react'

export default function KingQuentin() {
  // Module désactivé : nécessite fichier catalogue_web.csv non disponible en base
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <Crown className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">King Quentin 👑</h2>
        <p className="text-zinc-400 mb-4">Module non disponible</p>
        <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800 text-left">
          <p className="text-sm text-zinc-400">
            Ce module nécessite le fichier <code className="text-emerald-400">catalogue_web.csv</code> qui contient
            les produits disponibles sur le site web.
          </p>
          <p className="text-sm text-zinc-500 mt-2">
            Pour activer ce module, importez d'abord le catalogue web dans la base de données.
          </p>
        </div>
      </div>
    </div>
  )
}
