import heroPhoto from '../assets/hero-dogs.webp'

export function AuthHero() {
  return (
    <div className="relative flex w-full max-w-[430px] flex-col items-center text-center">
      <span className="hero-glow" aria-hidden />
      <div className="hero-photo-float w-full">
        <figure className="hero-photo">
          <img
            src={heroPhoto}
            width={1200}
            height={800}
            alt="A jack russell terrier in sunglasses shushing a wide-eyed golden retriever"
            loading="eager"
            decoding="async"
          />
          <span className="hero-photo__badge">
            <span aria-hidden>🤫</span>
            just us
          </span>
        </figure>
      </div>
      <p className="mt-6 hidden max-w-[300px] text-[13px] leading-relaxed text-muted sm:block">
        Good dogs keep quiet. A quiet corner of the internet, kept for a loud little circle of friends.
      </p>
    </div>
  )
}
