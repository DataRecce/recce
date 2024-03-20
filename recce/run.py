import pickle


def archive_artifacts(output_file: str = 'recce.pkl'):
    """Archive the artifacts"""
    from recce.dbt import load_dbt_context
    ctx = load_dbt_context()

    base = ctx.get_lineage(base=True)
    current = ctx.get_lineage(base=False)
    artifact = dict(
        base=base,
        current=current,
    )

    with open(output_file, 'wb') as f:
        pickle.dump(artifact, f)
        print(f"Artifact is saved to recce.pkl")
    pass
