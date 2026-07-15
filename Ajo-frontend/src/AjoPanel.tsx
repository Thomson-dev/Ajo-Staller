import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Circle } from 'ajo-client'
import { connectWallet, kit } from './lib/wallet'
import { getAjoClient, NATIVE_TOKEN_TESTNET } from './lib/contract'
import { truncateAddress } from './lib/address'
import { staggerContainer, fadeUpItem } from './lib/motion'

const tapFeedback = { scale: 0.97 }

type Status = { type: 'info' | 'success' | 'error'; text: string } | null
type Action = 'connect' | 'create' | 'join' | 'deposit' | 'close' | 'refresh' | 'copy' | null

type AjoPanelProps = {
  circleId: number | null
  onCircleCreated: (id: number) => void
}

function AjoPanel({ circleId, onCircleCreated }: AjoPanelProps) {
  const [address, setAddress] = useState<string | null>(null)
  const [circle, setCircle] = useState<Circle | null>(null)
  const [members, setMembers] = useState<string[]>([])
  const [defaulted, setDefaulted] = useState<string[]>([])
  const [received, setReceived] = useState<string[]>([])
  const [reputation, setReputation] = useState<number | null>(null)

  const [amount, setAmount] = useState('100')
  const [collateral, setCollateral] = useState('100')
  const [token, setToken] = useState(NATIVE_TOKEN_TESTNET)
  const [durationHours, setDurationHours] = useState('168')

  const [pending, setPending] = useState<Action>(null)
  const [status, setStatus] = useState<Status>(null)

  const isMember = address !== null && members.includes(address)
  const isDefaulted = address !== null && defaulted.includes(address)
  const upNext = members.find((m) => !defaulted.includes(m) && !received.includes(m)) ?? null
  const deadline = circle ? new Date(Number(circle.round_start + circle.round_duration) * 1000) : null

  async function run(action: Exclude<Action, null>, work: () => Promise<void>, successText: string) {
    setPending(action)
    setStatus(null)
    try {
      await work()
      setStatus({ type: 'success', text: successText })
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message ?? 'Something went wrong' })
    } finally {
      setPending(null)
    }
  }

  async function loadCircle(id: number, addr: string | null) {
    const client = getAjoClient(addr ?? undefined)
    const [circleTx, membersTx, defaultedTx, receivedTx] = await Promise.all([
      client.get_circle({ circle_id: BigInt(id) }),
      client.get_members({ circle_id: BigInt(id) }),
      client.get_defaulted({ circle_id: BigInt(id) }),
      client.get_received({ circle_id: BigInt(id) }),
    ])
    setCircle(circleTx.result)
    setMembers(membersTx.result)
    setDefaulted(defaultedTx.result)
    setReceived(receivedTx.result)
  }

  async function loadReputation(addr: string) {
    const client = getAjoClient(addr)
    const tx = await client.get_reputation({ member: addr })
    setReputation(tx.result)
  }

  useEffect(() => {
    if (!address) return
    loadReputation(address).catch(() => {})
    if (circleId !== null) {
      loadCircle(circleId, address).catch((err) =>
        setStatus({ type: 'error', text: (err as Error).message ?? 'Could not load that circle' }),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, circleId])

  function handleConnect() {
    run('connect', async () => {
      const addr = await connectWallet()
      setAddress(addr)
    }, 'Wallet connected')
  }

  function handleDisconnect() {
    kit.disconnect?.().catch(() => {})
    setAddress(null)
    setCircle(null)
    setMembers([])
    setDefaulted([])
    setReceived([])
    setReputation(null)
    setStatus(null)
  }

  function handleCreateCircle() {
    run('create', async () => {
      const client = getAjoClient(address!)
      const tx = await client.create_circle({
        admin: address!,
        token,
        amount: BigInt(amount),
        collateral: BigInt(collateral),
        round_duration: BigInt(Math.round(Number(durationHours) * 3600)),
      })
      const { result } = await tx.signAndSend()
      onCircleCreated(Number(result))
    }, 'Circle created')
  }

  function handleJoin() {
    run('join', async () => {
      const client = getAjoClient(address!)
      const tx = await client.join({ circle_id: BigInt(circleId!), member: address! })
      await tx.signAndSend()
      await loadCircle(circleId!, address)
    }, 'You joined the circle — your collateral is locked')
  }

  function handleDeposit() {
    run('deposit', async () => {
      const client = getAjoClient(address!)
      const tx = await client.deposit({ circle_id: BigInt(circleId!), member: address! })
      await tx.signAndSend()
      await loadCircle(circleId!, address)
    }, 'Contribution deposited')
  }

  function handleCloseRound() {
    run('close', async () => {
      const client = getAjoClient(address ?? undefined)
      const tx = await client.close_round({ circle_id: BigInt(circleId!) })
      await tx.signAndSend()
      await loadCircle(circleId!, address)
      if (address) await loadReputation(address)
    }, 'Round closed')
  }

  function handleCopyInviteLink() {
    run('copy', async () => {
      await navigator.clipboard.writeText(window.location.href)
    }, 'Invite link copied — send it to the people joining your circle')
  }

  function handleRefresh() {
    run('refresh', async () => {
      if (circleId !== null) await loadCircle(circleId, address)
      if (address) await loadReputation(address)
    }, 'Up to date')
  }

  return (
    <section id="dashboard">
      <motion.div
        className="dashboard-card"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {!address ? (
          <div className="connect-prompt">
            <h2>Join a circle</h2>
            <p>Connect your Stellar wallet to view this circle and take part.</p>
            <motion.button
              type="button"
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={pending === 'connect'}
              whileTap={tapFeedback}
            >
              {pending === 'connect' ? 'Connecting…' : 'Connect Wallet'}
            </motion.button>
          </div>
        ) : circleId === null ? (
          <div className="connect-prompt">
            <h2>Start a circle</h2>
            <p>Set the terms for a new circle. You'll get a link to share with the people joining it.</p>
            <div className="setup-fields">
              <label>
                Contribution amount per round
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
              </label>
              <label>
                Collateral required to join
                <input value={collateral} onChange={(e) => setCollateral(e.target.value)} inputMode="numeric" />
              </label>
              <label>
                Round length (hours)
                <input value={durationHours} onChange={(e) => setDurationHours(e.target.value)} inputMode="numeric" />
              </label>
              <label>
                Token contract
                <input value={token} onChange={(e) => setToken(e.target.value)} />
              </label>
              <motion.button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateCircle}
                disabled={pending !== null}
                whileTap={tapFeedback}
              >
                {pending === 'create' ? 'Creating…' : 'Create circle'}
              </motion.button>
            </div>
          </div>
        ) : (
          <>
            <div className="dashboard-header">
              <div className="wallet-chip" title={address}>
                <span className="dot" />
                {truncateAddress(address)}
              </div>
              <motion.button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCopyInviteLink}
                disabled={pending !== null}
                whileTap={tapFeedback}
              >
                {pending === 'copy' ? 'Copying…' : 'Copy invite link'}
              </motion.button>
              <motion.button type="button" className="btn btn-ghost btn-sm" onClick={handleDisconnect} whileTap={tapFeedback}>
                Disconnect
              </motion.button>
            </div>

            <motion.div className="stat-grid" variants={staggerContainer} initial="initial" animate="animate">
              <motion.div className="stat" variants={fadeUpItem}>
                <span className="stat-label">Round</span>
                <span className="stat-value">{circle?.round ?? '—'}</span>
              </motion.div>
              <motion.div className="stat" variants={fadeUpItem}>
                <span className="stat-label">Members</span>
                <span className="stat-value">{members.length}</span>
              </motion.div>
              <motion.div className="stat" variants={fadeUpItem}>
                <span className="stat-label">Contribution</span>
                <span className="stat-value">{circle ? circle.amount.toString() : '—'}</span>
              </motion.div>
              <motion.div className="stat" variants={fadeUpItem}>
                <span className="stat-label">Your reputation</span>
                <span className="stat-value">{reputation ?? '—'}</span>
              </motion.div>
            </motion.div>

            <p className="muted">
              {circle?.completed
                ? 'This circle has completed — everyone has either received a payout or defaulted.'
                : deadline
                  ? `Round deadline: ${deadline.toLocaleString()} · Up next: ${upNext ? truncateAddress(upNext) : '—'}`
                  : null}
            </p>

            <div className="members">
              <h3>Members</h3>
              {members.length === 0 ? (
                <p className="muted">No one has joined yet.</p>
              ) : (
                <ol className="member-list">
                  <AnimatePresence initial={false}>
                    {members.map((m, i) => (
                      <motion.li
                        key={m}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.25 }}
                        className={m === upNext ? 'current' : ''}
                      >
                        <span className="position">{i + 1}</span>
                        <span className="member-address">{truncateAddress(m)}</span>
                        {m === address && <span className="tag">you</span>}
                        {m === upNext && <span className="tag tag-accent">up next</span>}
                        {received.includes(m) && <span className="tag tag-success">paid out</span>}
                        {defaulted.includes(m) && <span className="tag tag-error">defaulted</span>}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ol>
              )}
            </div>

            <div className="actions">
              <motion.button
                type="button"
                className="btn btn-primary"
                onClick={handleJoin}
                disabled={pending !== null || isMember || circle?.completed}
                whileTap={tapFeedback}
              >
                {pending === 'join' ? 'Joining…' : isMember ? 'Already joined' : 'Join circle (locks collateral)'}
              </motion.button>
              <motion.button
                type="button"
                className="btn btn-secondary"
                onClick={handleDeposit}
                disabled={pending !== null || !isMember || isDefaulted || circle?.completed}
                whileTap={tapFeedback}
              >
                {pending === 'deposit' ? 'Depositing…' : 'Deposit this round'}
              </motion.button>
              <motion.button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseRound}
                disabled={pending !== null || circle?.completed}
                whileTap={tapFeedback}
                title="Permissionless — anyone can close a round once it's fully paid or overdue"
              >
                {pending === 'close' ? 'Closing…' : 'Close round'}
              </motion.button>
              <motion.button type="button" className="btn btn-ghost" onClick={handleRefresh} disabled={pending !== null} whileTap={tapFeedback}>
                {pending === 'refresh' ? 'Refreshing…' : 'Refresh'}
              </motion.button>
            </div>
          </>
        )}

        <AnimatePresence>
          {status && (
            <motion.p
              key={status.text}
              className={`status status-${status.type}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {status.text}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}

export default AjoPanel
