import { Share2, Facebook, Twitter, Linkedin, Copy, Check } from "lucide-react";
import { useState } from "react";

interface ShareButtonsProps {
  title: string;
  url: string;
  description?: string;
}

/**
 * Share Buttons Component
 * Allows users to share content on social media
 */
export const ShareButtons = ({ title, url, description }: ShareButtonsProps) => {
  const [copied, setCopied] = useState(false);
  
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || title);

  const shareLinks = [
    {
      name: "فيسبوك",
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: "hover:bg-blue-600 hover:text-white",
    },
    {
      name: "تويتر",
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      color: "hover:bg-sky-500 hover:text-white",
    },
    {
      name: "لينكدإن",
      icon: Linkedin,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: "hover:bg-sky-700 hover:text-white",
    },
  ];

  const handleShare = (shareUrl: string) => {
    window.open(shareUrl, "_blank", "width=600,height=400");
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground ml-2">مشاركة:</span>
      
      {shareLinks.map((link) => (
        <button
          key={link.name}
          onClick={() => handleShare(link.url)}
          className={`p-2 rounded-lg bg-secondary/50 text-muted-foreground transition-all duration-300 ${link.color} focus:outline-none focus:ring-2 focus:ring-primary`}
          aria-label={`مشاركة على ${link.name}`}
          title={`مشاركة على ${link.name}`}
        >
          <link.icon className="w-4 h-4" />
        </button>
      ))}
      
      <button
        onClick={copyToClipboard}
        className={`p-2 rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary ${
          copied 
            ? "bg-green-500/20 text-green-500" 
            : "bg-secondary/50 text-muted-foreground hover:bg-primary/20 hover:text-primary"
        }`}
        aria-label={copied ? "تم النسخ" : "نسخ الرابط"}
        title={copied ? "تم النسخ" : "نسخ الرابط"}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default ShareButtons;
