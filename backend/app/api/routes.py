"""HTTP 路由。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas.analysis import AnalyzeRequest, AnalyzeResponse
from ..services.analyzer import analyze

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse, summary="一次性分析线性连续系统")
def analyze_endpoint(payload: AnalyzeRequest) -> AnalyzeResponse:
    try:
        return analyze(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
