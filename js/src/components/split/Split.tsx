import ReactSplit, { SplitProps } from "react-split";
import "./styles.css";

export const HSplit = (props: SplitProps) => {
  const { style, children, ...rest } = props;

  return (
    <ReactSplit
      style={{
        display: "flex",
        flexDirection: "row",
        ...style,
      }}
      direction="horizontal"
      {...rest}
    >
      {children}
    </ReactSplit>
  );
};

export const VSplit = (props: SplitProps) => {
  const { style, children, ...rest } = props;

  return (
    <ReactSplit
      style={{
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
      direction="vertical"
      {...rest}
    >
      {children}
    </ReactSplit>
  );
};
