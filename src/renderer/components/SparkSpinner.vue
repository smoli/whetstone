<script setup lang="ts">
// The app-icon's ember spark, reused as a status indicator: it spins while the
// teacher is thinking and rests still while waiting for input. Flat fill to match
// the app's flat design.
withDefaults(defineProps<{ spinning?: boolean; size?: number }>(), { spinning: false, size: 27 })
</script>

<template>
  <span
    class="spark-spinner"
    :class="{ 'is-spinning': spinning }"
    :style="{ width: size + 'px', height: size + 'px' }"
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 1024 1024"
      width="100%"
      height="100%"
    >
      <path
        class="spark"
        d="M512 190 Q556 406 772 450 Q556 494 512 710 Q468 494 252 450 Q468 406 512 190 Z"
        fill="var(--accent)"
      />
    </svg>
  </span>
</template>

<style scoped>
.spark-spinner {
  display: inline-flex;
  flex: 0 0 auto;
  line-height: 0;
  vertical-align: middle;
}
.spark {
  transform-box: fill-box;
  transform-origin: center;
}
/* Resting: a gentle breathing twinkle so it reads as "alive, waiting". */
.spark-spinner:not(.is-spinning) .spark {
  animation: spark-rest 3.2s ease-in-out infinite;
}
/* Thinking: a full turn per cycle, but with uneven pacing + wobble so it feels
   restless/chaotic rather than a smooth mechanical spin (same overall speed). */
.spark-spinner.is-spinning .spark {
  animation: spark-spin 1.5s linear infinite;
}
@keyframes spark-spin {
  0% {
    transform: rotate(0deg) scale(1);
  }
  14% {
    transform: rotate(22deg) scale(0.93);
  }
  29% {
    transform: rotate(150deg) scale(1.08);
  }
  43% {
    transform: rotate(188deg) scale(0.96);
  }
  60% {
    transform: rotate(300deg) scale(1.06);
  }
  78% {
    transform: rotate(326deg) scale(0.94);
  }
  100% {
    transform: rotate(360deg) scale(1);
  }
}
@keyframes spark-rest {
  0%,
  100% {
    opacity: 0.78;
    transform: scale(0.94);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spark-spinner .spark {
    animation: none;
  }
}
</style>
