<script setup lang="ts">
// The app-icon's ember spark, reused as a status indicator: it spins while the
// teacher is thinking and rests still while waiting for input.
withDefaults(defineProps<{ spinning?: boolean; size?: number }>(), { spinning: false, size: 18 })
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
      <defs>
        <linearGradient
          id="spk-grad"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0"
            stop-color="#ffe1b8"
          />
          <stop
            offset="0.45"
            stop-color="#f6a14a"
          />
          <stop
            offset="1"
            stop-color="#b5532a"
          />
        </linearGradient>
      </defs>
      <path
        class="spark"
        d="M512 190 Q556 406 772 450 Q556 494 512 710 Q468 494 252 450 Q468 406 512 190 Z"
        fill="url(#spk-grad)"
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
/* Resting state: a gentle breathing twinkle so it reads as "alive, waiting". */
.spark-spinner:not(.is-spinning) .spark {
  animation: spark-rest 3.2s ease-in-out infinite;
}
/* Thinking: a steady spin with a soft ember glow. */
.spark-spinner.is-spinning {
  filter: drop-shadow(0 0 2.5px rgba(246, 161, 74, 0.65));
}
.spark-spinner.is-spinning .spark {
  animation: spark-spin 1.25s linear infinite;
}
@keyframes spark-spin {
  to {
    transform: rotate(360deg);
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
