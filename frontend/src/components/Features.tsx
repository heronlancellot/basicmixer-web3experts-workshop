import { memo } from 'react'
import { containerPadding } from '@/utils/classNames'
import { Icon } from '@/components/ui'
import { useScrollReveal } from '@/hooks/useScrollReveal'

interface FeatureProps {
  icon: React.ReactNode
  title: string
  description: string
  stagger: number
}

const FeatureCard = memo(function FeatureCard({ icon, title, description, stagger }: FeatureProps) {
  const ref = useScrollReveal<HTMLDivElement>(stagger)
  return (
    <div ref={ref} className="flex flex-col items-center text-center gap-5 sm:gap-6">
      <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl flex items-center justify-center bg-white/5">
        {icon}
      </div>
      <h4 className="text-[18px] sm:text-[20px] font-bold text-white">{title}</h4>
      <p className="text-[14px] sm:text-[15px] text-[#888888] leading-relaxed">{description}</p>
    </div>
  )
})

export const Features = memo(function Features() {
  return (
    <section className={`w-full py-16 md:py-24 lg:py-32 border-t border-white/5 ${containerPadding}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 lg:gap-16">
        <FeatureCard
          icon={<Icon name="lock" size={32} color="#ffffff" />}
          title="Non-Custodial"
          description="Your funds are secured by smart contracts. Only you control your assets."
          stagger={0}
        />
        <FeatureCard
          icon={<Icon name="shield" size={32} color="#ffffff" />}
          title="Compliant by Design"
          description="Association Set Provider screens deposits to block illicit funds."
          stagger={100}
        />
        <FeatureCard
          icon={<Icon name="document" size={32} color="#ffffff" />}
          title="Prove Innocence"
          description="Generate ZK proofs showing your funds aren't linked to bad actors."
          stagger={200}
        />
      </div>
    </section>
  )
})
