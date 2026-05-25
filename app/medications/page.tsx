import { redirect } from 'next/navigation'

export default function MedicationsRedirectPage() {
  redirect('/diary?tab=medications')
}
