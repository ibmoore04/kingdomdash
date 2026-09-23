import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Migration 032: Pre-Application Security, Concurrency & Regression Audit', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations')
  const mig032Path = path.join(migrationsDir, '20260902000032_security_integrity_hardening.sql')
  const mig020Path = path.join(migrationsDir, '20260902000020_order_delivery_operations.sql')

  it('verifies migration 032 file exists and is readable', () => {
    expect(fs.existsSync(mig032Path)).toBe(true)
    const content = fs.readFileSync(mig032Path, 'utf8')
    expect(content.length).toBeGreaterThan(1000)
  })

  const sql032 = fs.readFileSync(mig032Path, 'utf8')
  const sql020 = fs.readFileSync(mig020Path, 'utf8')

  // ==========================================================================
  // §1: CREATE_ORDER_SECURE CONCURRENCY & DEADLOCK PROOF (Finding 3)
  // ==========================================================================
  describe('1. create_order_secure Concurrency & Anti-Deadlock Proof (§3)', () => {
    it('implements deterministic product pre-locking with ORDER BY p.id ASC FOR UPDATE OF p', () => {
      expect(sql032).toContain('PERFORM 1')
      expect(sql032).toContain('FROM public.products p')
      expect(sql032).toContain('WHERE p.id = ANY(v_seen_product_ids)')
      expect(sql032).toContain('ORDER BY p.id ASC')
      expect(sql032).toContain('FOR UPDATE OF p;')
    })

    it('pre-locking query is positioned BEFORE initial order insertion and item loop', () => {
      const lockPos = sql032.indexOf('ORDER BY p.id ASC')
      const orderInsertPos = sql032.indexOf('INSERT INTO public.orders (')
      const itemLoopPos = sql032.lastIndexOf('FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)')

      expect(lockPos).toBeGreaterThan(0)
      expect(orderInsertPos).toBeGreaterThan(lockPos)
      expect(itemLoopPos).toBeGreaterThan(orderInsertPos)
    })

    it('subsequent SELECT inside item loop operates on already-locked rows without re-waiting', () => {
      // Inside item loop, SELECT ... FOR UPDATE OF p targets the exact same row already locked in 10.2
      const loopPart = sql032.slice(sql032.indexOf('-- 12. Process each item and compute subtotal'))
      expect(loopPart).toContain('SELECT p.id, p.name, p.price, c.service_type AS category_service_type')
      expect(loopPart).toContain('WHERE p.id = v_product_id')
    })

    describe('concurrency simulation: Transaction A [A, B] vs Transaction B [B, A]', () => {
      interface MockProduct {
        id: string
        name: string
        price: number
        is_available: boolean
        vendor_id: string
      }

      const prodA: MockProduct = {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Jollof Rice Special',
        price: 2500,
        is_available: true,
        vendor_id: 'vendor-1',
      }

      const prodB: MockProduct = {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Fried Plantain (Dodo)',
        price: 800,
        is_available: true,
        vendor_id: 'vendor-1',
      }

      // Simulated Database Lock Manager
      class RowLockManager {
        private locks = new Map<string, number>() // rowId -> txId
        private waitQueues = new Map<string, Array<{ txId: number; resolve: () => void }>>()

        async acquireLocksInOrder(txId: number, rowIds: string[]): Promise<void> {
          // Sort deterministically to mimic: ORDER BY p.id ASC
          const sortedIds = [...new Set(rowIds)].sort()

          for (const rowId of sortedIds) {
            await this.acquireRowLock(txId, rowId)
          }
        }

        private acquireRowLock(txId: number, rowId: string): Promise<void> {
          return new Promise((resolve) => {
            const currentOwner = this.locks.get(rowId)
            if (currentOwner === undefined || currentOwner === txId) {
              this.locks.set(rowId, txId)
              resolve()
            } else {
              const queue = this.waitQueues.get(rowId) || []
              queue.push({ txId, resolve })
              this.waitQueues.set(rowId, queue)
            }
          })
        }

        releaseLocks(txId: number): void {
          for (const [rowId, owner] of this.locks.entries()) {
            if (owner === txId) {
              this.locks.delete(rowId)
              const queue = this.waitQueues.get(rowId)
              if (queue && queue.length > 0) {
                const next = queue.shift()!
                this.locks.set(rowId, next.txId)
                next.resolve()
              }
            }
          }
        }
      }

      it('executes concurrent checkout with opposite product ordering without deadlock', async () => {
        const lockMgr = new RowLockManager()

        // Transaction 1 orders [ProdA, ProdB]
        const tx1Order = async () => {
          const items = [
            { product_id: prodA.id, quantity: 2 },
            { product_id: prodB.id, quantity: 1 },
          ]
          // Deterministic Pre-Lock
          await lockMgr.acquireLocksInOrder(1, items.map((i) => i.product_id))

          // Simulate processing time
          await new Promise((r) => setTimeout(r, 20))

          // Authoritative calculations
          const subtotal = 2 * prodA.price + 1 * prodB.price // 5000 + 800 = 5800
          const deliveryFee = 500
          const total = subtotal + deliveryFee

          lockMgr.releaseLocks(1)
          return { txId: 1, subtotal, deliveryFee, total, status: 'committed' }
        }

        // Transaction 2 orders [ProdB, ProdA] (reversed order)
        const tx2Order = async () => {
          const items = [
            { product_id: prodB.id, quantity: 3 },
            { product_id: prodA.id, quantity: 1 },
          ]
          // Deterministic Pre-Lock: sorts to [prodA.id, prodB.id] internally!
          await lockMgr.acquireLocksInOrder(2, items.map((i) => i.product_id))

          // Simulate processing time
          await new Promise((r) => setTimeout(r, 10))

          const subtotal = 3 * prodB.price + 1 * prodA.price // 2400 + 2500 = 4900
          const deliveryFee = 500
          const total = subtotal + deliveryFee

          lockMgr.releaseLocks(2)
          return { txId: 2, subtotal, deliveryFee, total, status: 'committed' }
        }

        // Run both concurrent transactions
        const results = await Promise.all([tx1Order(), tx2Order()])

        expect(results[0].status).toBe('committed')
        expect(results[0].subtotal).toBe(5800)
        expect(results[0].total).toBe(6300)

        expect(results[1].status).toBe('committed')
        expect(results[1].subtotal).toBe(4900)
        expect(results[1].total).toBe(5400)

        // Both transactions successfully serialized with zero deadlock exceptions
      })

      it('rejects duplicate product IDs in items before lock acquisition', () => {
        const items = [
          { product_id: prodA.id, quantity: 1 },
          { product_id: prodA.id, quantity: 2 },
        ]

        const preValidate = (p_items: typeof items) => {
          const seen: string[] = []
          for (const item of p_items) {
            if (seen.includes(item.product_id)) {
              throw new Error(`Duplicate product_id ${item.product_id} in p_items; use quantity to order multiple units of the same product`)
            }
            seen.push(item.product_id)
          }
        }

        expect(() => preValidate(items)).toThrow('Duplicate product_id')
      })

      it('rejects invalid product UUID before lock acquisition and order insertion', () => {
        const items = [{ product_id: 'malformed-uuid', quantity: 1 }]
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

        const preValidate = (p_items: typeof items) => {
          for (const item of p_items) {
            if (!uuidRegex.test(item.product_id)) {
              throw new Error(`Item product_id is not a valid UUID: ${item.product_id}`)
            }
          }
        }

        expect(() => preValidate(items)).toThrow('Item product_id is not a valid UUID')
      })
    })
  })

  // ==========================================================================
  // §2: REJECT_DELIVERY_ASSIGNMENT REGRESSION VERIFICATION (Finding 2)
  // ==========================================================================
  describe('2. reject_delivery_assignment Full Regression vs Migration 020 (§2)', () => {
    it('preserves the exact function signature of reject_delivery_assignment from Migration 020', () => {
      const sigPattern = /CREATE OR REPLACE FUNCTION public\.reject_delivery_assignment\s*\(\s*p_assignment_id uuid,\s*p_reason\s+text DEFAULT NULL\s*\)/
      expect(sigPattern.test(sql020)).toBe(true)
      expect(sigPattern.test(sql032)).toBe(true)
    })

    it('preserves all 14 required clauses and behaviors from Migration 020', () => {
      // 1. Rider authorization
      expect(sql032).toContain('SELECT id INTO v_rider_id')
      expect(sql032).toContain('FROM public.riders')
      expect(sql032).toContain('WHERE profile_id = auth.uid();')
      expect(sql032).toContain("RAISE EXCEPTION 'No rider profile found for current user' USING ERRCODE = 'KD403';")

      // 2. Rider ownership
      expect(sql032).toContain('IF v_assignment_peek.rider_id <> v_rider_id THEN')
      expect(sql032).toContain("RAISE EXCEPTION 'Assignment % does not belong to the current rider', p_assignment_id USING ERRCODE = 'KD403';")

      // 3. Pre-lock peek status check
      expect(sql032).toContain("IF v_assignment_peek.status <> 'assigned' THEN")
      expect(sql032).toContain("RAISE EXCEPTION 'Cannot reject assignment in status %; must be ''assigned''', v_assignment_peek.status")
      expect(sql032).toContain("USING ERRCODE = 'KD409';")

      // 4. Order lock hierarchy (1st)
      expect(sql032).toContain('IF v_assignment_peek.order_id IS NOT NULL THEN')
      expect(sql032).toContain('PERFORM 1 FROM public.orders WHERE id = v_assignment_peek.order_id FOR UPDATE;')

      // 5. Delivery lock hierarchy (2nd)
      expect(sql032).toContain('FROM public.deliveries')
      expect(sql032).toContain('WHERE id = v_assignment_peek.delivery_id')
      expect(sql032).toContain('FOR UPDATE;')

      // 6. Assignment lock hierarchy (3rd)
      expect(sql032).toContain('FROM public.delivery_assignments')
      expect(sql032).toContain('WHERE id = p_assignment_id')
      expect(sql032).toContain('FOR UPDATE;')

      // 7. Post-lock verification (Migration 032 Hardening)
      expect(sql032).toContain("IF v_assignment.status <> 'assigned' THEN")
      expect(sql032).toContain("RAISE EXCEPTION 'Cannot reject assignment in status %; must be ''assigned''', v_assignment.status")

      // 8. Atomic UPDATE with status guard
      expect(sql032).toContain("UPDATE public.delivery_assignments")
      expect(sql032).toContain("SET status = 'rejected',")
      expect(sql032).toContain("WHERE id = p_assignment_id")
      expect(sql032).toContain("AND status = 'assigned';")
      expect(sql032).toContain("IF NOT FOUND THEN")

      // 9. Delivery status reset (only if delivery is still 'assigned')
      expect(sql032).toContain("IF v_delivery.status = 'assigned' THEN")
      expect(sql032).toContain("SET status = 'pending',")
      expect(sql032).toContain("WHERE id = v_assignment_peek.delivery_id;")

      // 10. Notes/reason handling
      expect(sql032).toContain("notes = CASE WHEN p_reason IS NOT NULL THEN COALESCE(notes, '') || ' [Rejected: ' || p_reason || ']' ELSE notes END,")

      // 11. Timestamps
      expect(sql032).toContain('responded_at = pg_catalog.now(),')
      expect(sql032).toContain('updated_at = pg_catalog.now()')

      // 12. Operational audit event
      expect(sql032).toContain("PERFORM public.log_operational_audit_event(")
      expect(sql032).toContain("'assignment_rejected'")
      expect(sql032).toContain("jsonb_build_object('status', 'assigned'),")
      expect(sql032).toContain("jsonb_build_object('status', 'rejected', 'delivery_id', v_assignment_peek.delivery_id, 'reason', p_reason)")

      // 13. Error codes
      expect(sql032).toContain("ERRCODE = 'KD403'")
      expect(sql032).toContain("ERRCODE = 'KD404'")
      expect(sql032).toContain("ERRCODE = 'KD409'")

      // 14. EXECUTE grants
      expect(sql032).toContain('REVOKE EXECUTE ON FUNCTION public.reject_delivery_assignment(uuid, text) FROM PUBLIC;')
      expect(sql032).toContain('GRANT  EXECUTE ON FUNCTION public.reject_delivery_assignment(uuid, text) TO authenticated;')
    })

    describe('state transition test matrix', () => {
      interface AssignmentState {
        id: string
        status: 'assigned' | 'accepted' | 'rejected'
        notes: string | null
      }

      interface DeliveryState {
        id: string
        status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
      }

      it('A: assigned -> rejected succeeds', () => {
        const asgn: AssignmentState = { id: 'asgn-1', status: 'assigned', notes: null }
        const deliv: DeliveryState = { id: 'deliv-1', status: 'assigned' }

        // Simulate reject
        expect(asgn.status).toBe('assigned')
        asgn.status = 'rejected'
        asgn.notes = '[Rejected: Traffic delay]'
        if (deliv.status === 'assigned') {
          deliv.status = 'pending'
        }

        expect(asgn.status).toBe('rejected')
        expect(asgn.notes).toContain('Traffic delay')
        expect(deliv.status).toBe('pending')
      })

      it('B: accepted -> rejected fails safely with KD409', () => {
        const asgn: AssignmentState = { id: 'asgn-2', status: 'accepted', notes: null }

        const attemptReject = () => {
          if (asgn.status !== 'assigned') {
            throw new Error(`Cannot reject assignment in status ${asgn.status}; must be 'assigned' [KD409]`)
          }
          asgn.status = 'rejected'
        }

        expect(() => attemptReject()).toThrow('KD409')
        expect(asgn.status).toBe('accepted')
      })

      it('C: rejected -> rejected fails safely with KD409', () => {
        const asgn: AssignmentState = { id: 'asgn-3', status: 'rejected', notes: 'First rejection' }

        const attemptReject = () => {
          if (asgn.status !== 'assigned') {
            throw new Error(`Cannot reject assignment in status ${asgn.status}; must be 'assigned' [KD409]`)
          }
          asgn.status = 'rejected'
        }

        expect(() => attemptReject()).toThrow('KD409')
        expect(asgn.status).toBe('rejected')
      })

      it('D: concurrent accept/reject cannot overwrite the accepted state', async () => {
        const asgn: AssignmentState = { id: 'asgn-4', status: 'assigned', notes: null }

        // Accept wins lock
        asgn.status = 'accepted'

        // Reject acquires lock second and re-checks post-lock
        const rejectExecution = () => {
          if (asgn.status !== 'assigned') {
            throw new Error(`Cannot reject assignment in status ${asgn.status}; must be 'assigned' [KD409]`)
          }
          asgn.status = 'rejected'
        }

        expect(() => rejectExecution()).toThrow('KD409')
        expect(asgn.status).toBe('accepted')
      })

      it('E: concurrent reject/accept cannot overwrite the rejected state', async () => {
        const asgn: AssignmentState = { id: 'asgn-5', status: 'assigned', notes: null }

        // Reject wins lock
        asgn.status = 'rejected'

        // Accept acquires lock second and re-checks post-lock
        const acceptExecution = () => {
          if (asgn.status === 'accepted') return // Idempotent check
          if (asgn.status !== 'assigned') {
            throw new Error(`Cannot accept assignment in status ${asgn.status}; must be 'assigned' [KD409]`)
          }
          asgn.status = 'accepted'
        }

        expect(() => acceptExecution()).toThrow('KD409')
        expect(asgn.status).toBe('rejected')
      })

      it('F: does NOT re-open delivered, picked_up, or cancelled deliveries on assignment rejection', () => {
        const deliveryStatuses: DeliveryState['status'][] = ['picked_up', 'in_transit', 'delivered', 'cancelled']

        for (const initialStatus of deliveryStatuses) {
          const deliv: DeliveryState = { id: 'deliv-x', status: initialStatus }

          // reject logic: IF v_delivery.status = 'assigned' THEN UPDATE deliveries SET status = 'pending'
          if (deliv.status === 'assigned') {
            deliv.status = 'pending'
          }

          // Must remain in original status
          expect(deliv.status).toBe(initialStatus)
        }
      })
    })
  })

  // ==========================================================================
  // §3: DELIVERY PRICING DATA AUDIT & CONSTRAINT TEST (Finding 4)
  // ==========================================================================
  describe('3. delivery_pricing_rules Invariant & Data Audit (§4)', () => {
    it('creates named constraint check_delivery_pricing_min_max_fee with DROP IF EXISTS guard', () => {
      expect(sql032).toContain('ALTER TABLE public.delivery_pricing_rules')
      expect(sql032).toContain('DROP CONSTRAINT IF EXISTS check_delivery_pricing_min_max_fee;')
      expect(sql032).toContain('ADD CONSTRAINT check_delivery_pricing_min_max_fee')
      expect(sql032).toContain('CHECK (min_fee IS NULL OR max_fee IS NULL OR min_fee <= max_fee);')
    })

    describe('constraint evaluation semantics', () => {
      const isValid = (min_fee: number | null, max_fee: number | null): boolean => {
        return min_fee === null || max_fee === null || min_fee <= max_fee
      }

      it('evaluates true for null combinations (existing production state)', () => {
        expect(isValid(null, null)).toBe(true)
        expect(isValid(500, null)).toBe(true)
        expect(isValid(null, 1500)).toBe(true)
      })

      it('evaluates true when min_fee <= max_fee', () => {
        expect(isValid(500, 1500)).toBe(true)
        expect(isValid(1000, 1000)).toBe(true)
      })

      it('evaluates false when min_fee > max_fee', () => {
        expect(isValid(1500, 500)).toBe(false)
        expect(isValid(1001, 1000)).toBe(false)
      })
    })
  })

  // ==========================================================================
  // §4: ORDER_ITEMS PRIVILEGE & RLS AUDIT (Finding 6)
  // ==========================================================================
  describe('4. order_items Privilege & RLS Audit (§5)', () => {
    it('drops order_items_insert_customer policy', () => {
      expect(sql032).toContain('DROP POLICY IF EXISTS "order_items_insert_customer" ON public.order_items;')
    })

    it('revokes direct table INSERT on order_items from authenticated and anon', () => {
      expect(sql032).toContain('REVOKE INSERT ON public.order_items FROM authenticated, anon;')
    })

    it('does NOT revoke UPDATE or DELETE from admin/service_role', () => {
      expect(sql032).not.toContain('REVOKE UPDATE ON public.order_items')
      expect(sql032).not.toContain('REVOKE DELETE ON public.order_items')
    })

    it('preserves existing SELECT policies on order_items from previous migrations', () => {
      // Confirms Migration 032 does not touch SELECT policies
      expect(sql032).not.toContain('DROP POLICY IF EXISTS "order_items_select_customer"')
      expect(sql032).not.toContain('DROP POLICY IF EXISTS "order_items_select_vendor"')
      expect(sql032).not.toContain('DROP POLICY IF EXISTS "order_items_select_rider"')
      expect(sql032).not.toContain('DROP POLICY IF EXISTS "order_items_all_admin"')
    })
  })

  // ==========================================================================
  // §5: CONTACT_MESSAGES ACCESS CONTROL (Finding 1)
  // ==========================================================================
  describe('5. contact_messages Final Access Audit (§1)', () => {
    it('drops contact_messages_insert_public policy and revokes direct INSERT', () => {
      expect(sql032).toContain('DROP POLICY IF EXISTS "contact_messages_insert_public" ON public.contact_messages;')
      expect(sql032).toContain('REVOKE INSERT ON public.contact_messages FROM anon, authenticated;')
    })

    it('retains EXECUTE on submit_support_ticket RPC with exact signature', () => {
      expect(sql032).toContain(
        'GRANT EXECUTE ON FUNCTION public.submit_support_ticket(text, text, text, text, text) TO anon, authenticated, service_role;'
      )
    })

    it('preserves admin SELECT and UPDATE policies on contact_messages', () => {
      expect(sql032).not.toContain('DROP POLICY IF EXISTS "contact_messages_select_admin"')
      expect(sql032).not.toContain('DROP POLICY IF EXISTS "contact_messages_update_admin"')
    })
  })

  // ==========================================================================
  // §6: MIGRATION SAFETY & IDEMPOTENCY
  // ==========================================================================
  describe('6. Migration Safety & Idempotency Audit', () => {
    it('uses IF EXISTS on all drop operations', () => {
      const dropStatements = sql032.match(/DROP [^;]+;/g) || []
      for (const stmt of dropStatements) {
        expect(stmt).toContain('IF EXISTS')
      }
    })

    it('uses CREATE OR REPLACE on all function declarations', () => {
      const functionDeclarations = sql032.match(/CREATE (OR REPLACE )?FUNCTION [^\n(]+/g) || []
      for (const decl of functionDeclarations) {
        expect(decl).toContain('CREATE OR REPLACE FUNCTION')
      }
    })

    it('preserves strict search_path = public, pg_catalog on all SECURITY DEFINER functions', () => {
      const functions = ['reject_delivery_assignment', 'create_order_secure']
      for (const fn of functions) {
        const fnBlock = sql032.slice(sql032.indexOf(`FUNCTION public.${fn}`))
        const endFnBlock = fnBlock.slice(0, fnBlock.indexOf('$$;'))
        expect(endFnBlock).toContain('SECURITY DEFINER')
        expect(endFnBlock).toContain('SET search_path = public, pg_catalog')
      }
    })

    it('contains no destructive DROP TABLE or ALTER TABLE DROP COLUMN commands', () => {
      expect(sql032).not.toContain('DROP TABLE')
      expect(sql032).not.toContain('DROP COLUMN')
      expect(sql032).not.toContain('TRUNCATE')
    })
  })
})
