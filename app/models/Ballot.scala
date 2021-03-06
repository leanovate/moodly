package models

import play.api.db.slick.Config.driver.simple._
import play.api.libs.json._
import play.api.libs.json.JsObject
import play.api.libs.json.JsString
import play.api.libs.json.JsNumber
import play.api.libs.json

/**
 *
 * @param id technical ID
 * @param moodlyId moodly technical ID - reference to [[Moodly.id]]
 * @param cookieId cookieID, track an unique user. One user can vote only one time for one iteration
 * @param iterationCount current iteration, based on [[Moodly.start]] and [[Moodly.intervalDays]]
 * @param vote the vote: from 1 (frustrated) to 5 (happy)
 */
case class Ballot(id: Long, moodlyId: String, cookieId: String, iterationCount: Int, vote: Int) {

  assume(iterationCount >= 0)
  assume(vote >= 1) // frustrated
  assume(vote <= 5) // happy

  def this(cookieId: String, iterationCount: Int, vote: Int) =
    this(0, "", cookieId, iterationCount, vote)
}

object Ballot {

  implicit object BallotReadWrites extends Format[Ballot] {
    override def writes(ballot: Ballot) = JsObject(Seq(
      "id" -> JsNumber(ballot.id),
      "moodlyId" -> JsString(ballot.moodlyId),
      "iterationCount" -> JsNumber(ballot.iterationCount),
      "vote" -> JsNumber(ballot.vote)))

    override def reads(json: JsValue): JsResult[Ballot] = {
      val cookieId = (json \ "cookieId").as[String]
      val vote = (json \ "vote").as[Int]
      JsSuccess(new Ballot(cookieId, 0, vote))
    }
  }

}

class Ballots(tag: Tag) extends Table[Ballot](tag, "ballot") {
  def id = column[Long]("id", O.PrimaryKey, O.AutoInc)

  def moodlyId = column[String]("moodly_id", O.NotNull)

  def cookieId = column[String]("cookie_id", O.NotNull)

  def iterationCount = column[Int]("iteration_count", O.NotNull)

  def vote = column[Int]("vote", O.NotNull)

  def * = (id, moodlyId, cookieId, iterationCount, vote) <> ((Ballot.apply _).tupled, Ballot.unapply)

  def moodly = foreignKey("moodly_fk", moodlyId, Moodlies.moodlies)(_.id)
}

object Ballots {
  val ballots = TableQuery[Ballots]

  def insert(ballot: Ballot)(implicit s: Session): Long = {
    ballots.returning(ballots.map(_.id)).insert(ballot)
  }

  def findById(id: Long)(implicit s: Session): Option[Ballot] = {
    ballots.filter(_.id === id).firstOption
  }

  def findByMoodlyId(moodlyId: String)(implicit s: Session): List[Ballot] = {
    ballots.filter(_.moodlyId === moodlyId).sortBy(_.iterationCount).list
  }
}
