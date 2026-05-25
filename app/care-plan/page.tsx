import { redirect } from 'next/navigation'

export default function CarePlanRedirectPage() {
  redirect('/diary?tab=plan')
}
