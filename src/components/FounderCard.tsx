import { Facebook, MessageCircle, Linkedin, Github, Shield, Sparkles, User } from "lucide-react";
import { founderSocials } from "@/data/mockData";

const FounderCard = () => {
  const socials = [
    { icon: Facebook, url: founderSocials.facebook, label: "Facebook", color: "hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/50" },
    { icon: MessageCircle, url: founderSocials.whatsapp, label: "WhatsApp", color: "hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/50" },
    { icon: Linkedin, url: founderSocials.linkedin, label: "LinkedIn", color: "hover:bg-sky-500/20 hover:text-sky-400 hover:border-sky-500/50" },
    { icon: Github, url: founderSocials.github, label: "GitHub", color: "hover:bg-purple-500/20 hover:text-purple-400 hover:border-purple-500/50" },
  ];

  return (
    <div className="relative">
      {/* Section Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 mb-4">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">تعرف على المؤسس</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-foreground">
          من وراء <span className="text-primary">المنصة</span>
        </h2>
      </div>

      {/* Main Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-primary/5 border border-border/50">
        {/* Background Effects */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        
        {/* Cyber Grid */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'linear-gradient(hsl(var(--primary)/0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.5) 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }} />

        <div className="relative p-6 md:p-10">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Avatar Section */}
            <div className="relative flex-shrink-0">
              {/* Outer Glow Ring */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-cyan-400 to-primary rounded-3xl blur-xl opacity-40 scale-110" />
              
              {/* Image Container */}
              <div className="relative">
                {/* Decorative Border */}
                <div className="absolute -inset-1 bg-gradient-to-br from-primary via-cyan-400 to-primary rounded-3xl opacity-70" />
                
                <img
                  src="/founder.jpeg"
                  alt={founderSocials.name}
                  className="relative w-40 h-52 md:w-48 md:h-64 rounded-3xl object-cover object-top border-4 border-background"
                  width={192}
                  height={256}
                  loading="lazy"
                  decoding="async"
                />
                
                {/* Status Badge */}
                <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-primary to-cyan-400 rounded-xl px-3 py-1.5 shadow-lg">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary-foreground" />
                    <span className="text-xs font-bold text-primary-foreground">Cyber</span>
                  </div>
                </div>
              </div>
              
              {/* Experience Badge */}
              <div className="absolute -top-3 -left-3 bg-card border-2 border-primary/50 rounded-2xl px-4 py-2 shadow-lg">
                <div className="text-center">
                  <span className="text-2xl font-black text-primary">{founderSocials.experience}</span>
                  <p className="text-[10px] text-muted-foreground font-medium">{founderSocials.experienceLabel}</p>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="flex-1 text-center lg:text-right">
              {/* Name & Title */}
              <div className="mb-4">
                <h3 className="text-3xl md:text-4xl font-black text-foreground mb-2">
                  {founderSocials.name}
                </h3>
                <div className="flex items-center justify-center lg:justify-start gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-lg px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-semibold text-primary">{founderSocials.role}</span>
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">{founderSocials.title}</span>
                </div>
              </div>

              {/* Bio */}
              <p className="text-muted-foreground leading-relaxed mb-6 max-w-xl mx-auto lg:mx-0">
                {founderSocials.bio}
              </p>

              {/* Social Links */}
              <div className="flex items-center justify-center lg:justify-start gap-3">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group relative p-3.5 rounded-xl bg-secondary/30 border border-border text-muted-foreground transition-all duration-300 hover:scale-110 ${social.color}`}
                    aria-label={social.label}
                  >
                    <social.icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                  </a>
                ))}
              </div>

              {/* Contact CTA */}
              <div className="mt-6 pt-6 border-t border-border/50">
                <a
                  href={founderSocials.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-xl px-6 py-3 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-green-500/25"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>تواصل معي على واتساب</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FounderCard;
