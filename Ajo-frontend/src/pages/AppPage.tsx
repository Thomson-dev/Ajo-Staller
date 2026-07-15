import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import AjoPanel from '../AjoPanel'
import { pageVariants, staggerContainer, fadeUpItem } from '../lib/motion'

function AppPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const circleParam = searchParams.get('circle')
  const circleId = circleParam !== null && /^\d+$/.test(circleParam) ? Number(circleParam) : null

  function handleCircleCreated(id: number) {
    setSearchParams({ circle: String(id) })
  }

  return (
    <motion.div className="page" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <header id="site-header">
        <div className="brand">
          <Link to="/" className="brand-link">
            <span className="brand-mark">Ajo</span>
          </Link>
          <span className="badge">Testnet</span>
        </div>
        <Link to="/" className="btn btn-ghost btn-sm">
          ← Home
        </Link>
      </header>

      <motion.section
        id="hero"
        className="hero-compact"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.h1 variants={fadeUpItem}>Your circle</motion.h1>
        <motion.p variants={fadeUpItem}>
          {circleId !== null
            ? `Connect your wallet to join, deposit, and track payouts for circle #${circleId}.`
            : 'Connect your wallet to start a new savings circle, or open one via the link a member shared.'}
        </motion.p>
      </motion.section>

      <AjoPanel circleId={circleId} onCircleCreated={handleCircleCreated} />

      <footer id="site-footer">
        <p>Ajo runs entirely on a Soroban smart contract — funds only ever move between members and the contract.</p>
      </footer>
    </motion.div>
  )
}

export default AppPage
