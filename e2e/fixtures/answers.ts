import type { ApiLessonDetail } from '../helpers/db.helper';

export function buildGenericAnswers(lesson: ApiLessonDetail) {
  return lesson.questions.map((question) => {
    if (question.type === 'single_choice') {
      return {
        questionId: question.id,
        answer: question.options[0] ?? ''
      };
    }

    return {
      questionId: question.id,
      answer: 'placeholder-answer'
    };
  });
}
