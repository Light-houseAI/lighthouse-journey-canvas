import React from 'react';
import { motion } from 'framer-motion';

interface NaviGuideProps {
  onClick: () => void;
  isVisible: boolean;
}

const NaviGuide: React.FC<NaviGuideProps> = ({ onClick, isVisible }) => {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: isVisible ? 1 : 0, 
        opacity: isVisible ? 1 : 0,
        x: [0, 3, -3, 0],
        y: [0, -2, 2, 0]
      }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{
        scale: { duration: 0.3 },
        opacity: { duration: 0.3 },
        x: { 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut" 
        },
        y: { 
          duration: 3, 
          repeat: Infinity, 
          ease: "easeInOut",
          delay: 1.5
        }
      }}
      whileHover={{ 
        scale: 1.1,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-4 right-4 z-50 cursor-pointer"
    >
      {/* Main Navi Orb */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Outer glow rings */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.1, 0.3]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/30 to-accent/30 blur-md"
        />
        
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.5, 0.2, 0.5]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5
          }}
          className="absolute inset-2 rounded-full bg-gradient-to-r from-primary/40 to-accent/40 blur-sm"
        />

        {/* Core light */}
        <motion.div
          animate={{ 
            opacity: [0.8, 1, 0.8],
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative w-8 h-8 rounded-full bg-gradient-to-r from-white via-primary to-accent shadow-lg"
          style={{
            boxShadow: `
              0 0 20px hsl(var(--primary) / 0.6),
              0 0 40px hsl(var(--primary) / 0.4),
              0 0 60px hsl(var(--primary) / 0.2)
            `
          }}
        />

        {/* Radiating beams */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((rotation, index) => (
          <motion.div
            key={rotation}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 0.6, 0],
              scaleY: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.2
            }}
            className="absolute w-0.5 h-8 bg-gradient-to-t from-transparent via-primary to-transparent origin-bottom"
            style={{
              transform: `rotate(${rotation}deg) translateY(-24px)`,
              filter: 'blur(0.5px)'
            }}
          />
        ))}

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              x: [0, Math.sin(i * 60) * 20, 0],
              y: [0, Math.cos(i * 60) * 20, 0],
              opacity: [0, 0.8, 0],
              scale: [0, 1, 0]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5
            }}
            className="absolute w-1 h-1 bg-primary rounded-full"
            style={{
              filter: 'blur(0.5px)'
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default NaviGuide;