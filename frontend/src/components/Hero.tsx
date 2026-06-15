import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { containerPadding } from '@/utils'
import { BASIC_MIXER_ADDRESS } from '@/helpers/contract'
import { publicClient } from '@/config/client'
import { useBasicMixer } from '@/hooks/useBasicMixer'
import { formatEther } from 'viem'
import { StatusItem } from '@/components/ui'
import { ActionCard } from '@/components'
import { EncryptedText } from './EncryptedText'
import { useScrollReveal } from '@/hooks/useScrollReveal'

export const Hero = () => {
  const { isConnected } = useAccount()
  const { nextIndex } = useBasicMixer();
  const [balance, setBalance] = useState<bigint | undefined | string>(undefined);
  const headingRef = useScrollReveal<HTMLDivElement>();
  const statsRef = useScrollReveal<HTMLDivElement>(200);
  const actionRef = useScrollReveal<HTMLDivElement>(100);

  useEffect(() => {
    try {
      const contractBalance = async () => {

        const balanceContract = await publicClient.getBalance({
          address: BASIC_MIXER_ADDRESS,
        })
        setBalance(`${formatEther(balanceContract)} ETH`)
      }
      contractBalance()
    }
    catch (error) {
      console.log("error =", error)
    }

  }, [balance, nextIndex])

  return (
    <section className={`w-full h-full py-12 md:py-20 lg:py-28 ${containerPadding}`}>
      <div className="flex flex-col lg:flex-row justify-between items-start gap-12 lg:gap-16 xl:gap-20">
        <div className="flex-1 flex flex-col gap-12 sm:gap-16">
          <div ref={headingRef} className="flex flex-col gap-8 sm:gap-10">
            <h2 className="heading-hero">
              <span className="text-white">Programmable <EncryptedText text="Privacy" /></span>
            </h2>
            <p className="text-[15px] sm:text-[16px] lg:text-[17px] text-[#888888] leading-relaxed lg:pr-8">
              A privacy-preserving ETH pool on Sepolia Network.<br />
              Unlink deposits and withdrawals using zero-knowledge proofs.
            </p>
          </div>

          <div ref={statsRef} className="flex flex-wrap gap-8 sm:gap-12 lg:gap-4">
            <StatusItem value={balance} label="Total Value Locked" />
            <StatusItem value={nextIndex} label="Total Deposits" />
          </div>
        </div>

        <div ref={actionRef} className="w-full lg:w-[520px] xl:w-[560px] lg:flex-shrink-0">
          <ActionCard isConnected={isConnected} />
        </div>
      </div>
    </section>
  )
}
