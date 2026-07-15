import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants, staggerContainer, fadeUpItem } from '../lib/motion'

const CONTRACT_ID = 'CCAWRA5NZZFRM62JAQHK75UQTVLYGSB4GX4HX6AP7WX66FOGHQ66MVJJ'

function Landing() {
  return (
    <motion.div className="page" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <header id="site-header">
        <div className="brand">
          <span className="brand-mark">Ajo</span>
          <span className="badge">Testnet</span>
        </div>
        <Link to="/app" className="btn btn-primary btn-sm">
          Launch App
        </Link>
      </header>

      <motion.section
        id="hero"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.h1 variants={fadeUpItem}>Rotating savings, on-chain.</motion.h1>
        <motion.p variants={fadeUpItem}>
          Ajo is a trustless rotating savings circle built on Stellar. Members contribute
          each round; the pot goes to a different member every time — no organizer required.
        </motion.p>
        <motion.div className="cta-row" variants={fadeUpItem}>
          <Link to="/app" className="btn btn-primary">
            Launch App
          </Link>
          <a
            className="btn btn-secondary"
            href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noreferrer"
          >
            View contract ↗
          </a>
        </motion.div>
      </motion.section>

      <section id="how-it-works">
        <h2>How it works</h2>
        <motion.div
          className="steps"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.div className="step" variants={fadeUpItem}>
            <span className="step-number">1</span>
            <h3>Join the circle</h3>
            <p>Connect your wallet and join. Your position in the queue is set by join order.</p>
          </motion.div>
          <motion.div className="step" variants={fadeUpItem}>
            <span className="step-number">2</span>
            <h3>Deposit each round</h3>
            <p>Every member contributes the same fixed amount into the pot for the round.</p>
          </motion.div>
          <motion.div className="step" variants={fadeUpItem}>
            <span className="step-number">3</span>
            <h3>Receive the pot</h3>
            <p>Once everyone has paid in, the full pot is sent to that round&apos;s member automatically.</p>
          </motion.div>
        </motion.div>
      </section>

      <section id="features">
        <motion.div
          className="features"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.div className="feature" variants={fadeUpItem}>
            <h3>Non-custodial</h3>
            <p>Funds only ever move between members and the contract — no organizer ever holds the pot.</p>
          </motion.div>
          <motion.div className="feature" variants={fadeUpItem}>
            <h3>Deterministic order</h3>
            <p>Payout order matches join order. No one can skip the line or change the schedule.</p>
          </motion.div>
          <motion.div className="feature" variants={fadeUpItem}>
            <h3>Built on Soroban</h3>
            <p>An open, auditable smart contract running on the Stellar network.</p>
          </motion.div>
        </motion.div>
      </section>

      <footer id="site-footer">
        <p>Ajo runs entirely on a Soroban smart contract — funds only ever move between members and the contract.</p>
      </footer>
    </motion.div>
  )
}

export default Landing
