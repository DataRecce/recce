import ReactSplit, { SplitProps } from "react-split";
import "./styles.css";

export const HSplit = (props: SplitProps) => {
  const { style, children, gutterSize = 5, ...rest } = props;

  return (
    <ReactSplit
      style={{
        display: "flex",
        flexDirection: "row",
        ...style,
      }}
      direction="horizontal"
      gutterSize={gutterSize}
      {...rest}
    >
      {children}
    </ReactSplit>
  );
};

export const VSplit = (props: SplitProps) => {
  const { style, children, gutterSize = 5, ...rest } = props;

  return (
    <ReactSplit
      style={{
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
      gutterSize={gutterSize}
      direction="vertical"
      {...rest}
    >
      {children}
    </ReactSplit>
  );
};
