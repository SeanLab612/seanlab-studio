import { Composition, registerRoot } from "remotion";
import { reviewCompositions } from "./compositions/review-registry";

const ReviewRoot = () => (
  <>
    {reviewCompositions.map(({ id, component, durationInFrames }) => (
      <Composition
        key={id}
        id={id}
        component={component}
        durationInFrames={durationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />
    ))}
  </>
);

registerRoot(ReviewRoot);
